import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  ChevronLeft,
  ChevronRight,
  Coffee,
  ExternalLink,
  Minus,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ResolvedImage, ResolvedVideo } from './ResolvedMedia';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import {
  buildCartLineKey,
  getMilkExtraPrice,
  resolveItemModifiers,
} from '../lib/modifiers';
import {
  calculateCustomizationExtraPrice,
  getInitialSelectionsForCustomization,
  resolveSelectedCustomizationOptions,
  validateCustomerSelection,
} from '../lib/productCustomizations';
import {
  BillboardAd,
  CUSTOMER_APP_DOMAIN,
  CUSTOMER_APP_URL,
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_MENU_CATEGORIES,
  MenuItem,
  MilkOption,
  ORDER_STATUSES,
  Order,
  OrderLineItem,
  ProductCustomization,
  SelectedCustomizationOption,
  TemperatureOption,
  VALIDATION_LIMITS,
  formatPrice,
} from '../types';

interface CustomerStorefrontPreviewProps {
  billboards: BillboardAd[];
  menuItems: MenuItem[];
  categories: CategoryItem[];
  coffeeOptions: CoffeeOptionsSettings;
  productCustomizations?: Record<string, ProductCustomization>;
  orders: Order[];
  onOrderPlaced: () => void;
}

interface CartEntry {
  key: string;
  itemId: string;
  name: string;
  nameAr?: string;
  basePrice: number;
  price: number;
  quantity: number;
  milkOption?: MilkOption;
  milkExtraPrice?: number;
  temperature?: TemperatureOption;
  selectedCustomizations?: SelectedCustomizationOption[];
  specialInstructions?: string;
}

interface ItemSelectionState {
  milkOption: MilkOption;
  temperature: TemperatureOption;
}

function defaultTempForItem(item: MenuItem): TemperatureOption {
  return item.name.toLowerCase().includes('iced') ? 'Cold' : 'Hot';
}

function defaultMilkForItem(item: MenuItem): MilkOption {
  if (item.name.toLowerCase().includes('coconut')) return 'coconut';
  if (item.category === 'V60') return 'none';
  return 'regular';
}

export function CustomerStorefrontPreview({
  billboards,
  menuItems,
  categories,
  coffeeOptions,
  productCustomizations = {},
  orders,
  onOrderPlaced,
}: CustomerStorefrontPreviewProps) {
  const { user } = useAuth();
  const { lang, t, categoryLabel, statusLabel, localizedItemName } = useLanguage();
  const activeBillboards = useMemo(
    () => billboards.filter((ad) => ad.isActive),
    [billboards]
  );

  const activeCategoryKeys = useMemo(() => {
    const activeCats = [...categories]
      .filter((c) => c.isActive)
      .sort((a, b) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : a.nameEn.localeCompare(b.nameEn)
      )
      .map((c) => c.key);

    if (activeCats.length > 0) return activeCats;
    return DEFAULT_MENU_CATEGORIES;
  }, [categories]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const availableMenu = useMemo(
    () =>
      menuItems
        .filter((item) => item.inStock)
        .filter((item) => selectedCategory === 'All' || item.category === selectedCategory)
        .sort((a, b) => {
          const idxA = activeCategoryKeys.indexOf(a.category);
          const idxB = activeCategoryKeys.indexOf(b.category);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        }),
    [menuItems, selectedCategory, activeCategoryKeys]
  );

  const [slideIndex, setSlideIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, ItemSelectionState>>({});
  const [customSelections, setCustomSelections] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [itemInstructions, setItemInstructions] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPlacedOrderId, setLastPlacedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBillboards.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % activeBillboards.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activeBillboards.length]);

  const getSelectionForItem = (item: MenuItem): ItemSelectionState => {
    return (
      selections[item.id] || {
        milkOption: defaultMilkForItem(item),
        temperature: defaultTempForItem(item),
      }
    );
  };

  const setItemSelection = (
    item: MenuItem,
    patch: Partial<ItemSelectionState>
  ) => {
    setSelections((prev) => {
      const current = prev[item.id] || {
        milkOption: defaultMilkForItem(item),
        temperature: defaultTempForItem(item),
      };
      return {
        ...prev,
        [item.id]: { ...current, ...patch },
      };
    });
  };

  const cartEntries = useMemo(() => Object.values(cart), [cart]);

  const totalBill = useMemo(
    () => cartEntries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0),
    [cartEntries]
  );

  const activeSlide = activeBillboards[slideIndex] || null;
  const recentCustomerOrders = useMemo(
    () =>
      orders
        .filter((o) => !user || o.customerUid === user.uid)
        .slice(0, 3),
    [orders, user]
  );

  const getCustomSelectionForItem = (
    item: MenuItem,
    cfg: ProductCustomization
  ): Record<string, string[]> => {
    if (customSelections[item.id]) return customSelections[item.id];
    return getInitialSelectionsForCustomization(cfg);
  };

  const toggleCustomOption = (
    item: MenuItem,
    cfg: ProductCustomization,
    groupId: string,
    optionId: string
  ) => {
    setError(null);
    const group = cfg.groups.find((g) => g.id === groupId);
    if (!group) return;
    setCustomSelections((prev) => {
      const itemSel = prev[item.id] || getInitialSelectionsForCustomization(cfg);
      const current = itemSel[groupId] || [];
      let nextGroupSel: string[];
      if (group.type === 'single') {
        if (current[0] === optionId && !group.required && group.minSelections === 0) {
          nextGroupSel = [];
        } else {
          nextGroupSel = [optionId];
        }
      } else if (current.includes(optionId)) {
        nextGroupSel = current.filter((id) => id !== optionId);
      } else if (current.length >= group.maxSelections) {
        return prev;
      } else {
        nextGroupSel = [...current, optionId];
      }
      return {
        ...prev,
        [item.id]: {
          ...itemSel,
          [groupId]: nextGroupSel,
        },
      };
    });
  };

  const addConfiguredItemToCart = (item: MenuItem) => {
    const customCfg = productCustomizations[item.id];
    if (customCfg?.enabled) {
      const selectedMap = getCustomSelectionForItem(item, customCfg);
      const validation = validateCustomerSelection(customCfg, selectedMap);
      if (!validation.valid) {
        const firstErr = validation.errorMessages[0];
        setError(firstErr ? (lang === 'ar' ? firstErr.ar : firstErr.en) : null);
        return;
      }
      setError(null);
      const resolvedCustom = resolveSelectedCustomizationOptions(customCfg, selectedMap);
      const extraPrice = calculateCustomizationExtraPrice(customCfg, selectedMap);
      const unitPrice = Number((item.price + extraPrice).toFixed(2));
      const trimmedInstr = customCfg.allowSpecialInstructions
        ? (itemInstructions[item.id] || '').trim()
        : '';
      const optionSignature = resolvedCustom
        .map((s) => `${s.groupId}:${s.optionId}`)
        .join('|');
      const key = `${item.id}::custom::${optionSignature}::${trimmedInstr}`;

      setCart((prev) => {
        const existing = prev[key];
        return {
          ...prev,
          [key]: {
            key,
            itemId: item.id,
            name: item.name,
            ...(item.nameAr ? { nameAr: item.nameAr } : {}),
            basePrice: item.price,
            price: unitPrice,
            quantity: (existing?.quantity || 0) + 1,
            ...(resolvedCustom.length > 0 ? { selectedCustomizations: resolvedCustom } : {}),
            ...(trimmedInstr ? { specialInstructions: trimmedInstr } : {}),
          },
        };
      });
      return;
    }

    const resolved = resolveItemModifiers(item, categories, coffeeOptions);
    const sel = getSelectionForItem(item);
    const temperature = resolved.temperatureEnabled ? sel.temperature : undefined;
    const milkOption = resolved.milkEnabled ? sel.milkOption : undefined;
    const milkExtraPrice = resolved.milkEnabled
      ? getMilkExtraPrice(milkOption, resolved.coconutMilkPrice)
      : 0;
    const unitPrice = Number((item.price + milkExtraPrice).toFixed(2));
    const key = buildCartLineKey(item.id, temperature, milkOption);

    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          key,
          itemId: item.id,
          name: item.name,
          ...(item.nameAr ? { nameAr: item.nameAr } : {}),
          basePrice: item.price,
          price: unitPrice,
          quantity: (existing?.quantity || 0) + 1,
          ...(milkOption ? { milkOption } : {}),
          ...(milkExtraPrice > 0 ? { milkExtraPrice } : {}),
          ...(temperature ? { temperature } : {}),
        },
      };
    });
  };

  const updateCartEntryQty = (key: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return {
        ...prev,
        [key]: { ...existing, quantity: nextQty },
      };
    });
  };

  const formatModifierSummary = (
    temperature?: TemperatureOption,
    milkOption?: MilkOption,
    milkExtraPrice?: number
  ): string => {
    const parts: string[] = [];
    if (temperature) {
      parts.push(temperature === 'Hot' ? t.tempHot : t.tempCold);
    }
    if (milkOption === 'regular') {
      parts.push(t.milkRegular);
    } else if (milkOption === 'coconut') {
      parts.push(
        milkExtraPrice && milkExtraPrice > 0
          ? `${t.milkCoconut} (+${formatPrice(milkExtraPrice)})`
          : t.milkCoconut
      );
    } else if (milkOption === 'none') {
      parts.push(t.milkNone);
    }
    return parts.join(' · ');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const nameTrimmed = customerName.trim();
    const contactTrimmed = customerContact.trim();
    const notesTrimmed = notes.trim();

    if (!nameTrimmed || nameTrimmed.length > VALIDATION_LIMITS.order.customerNameMaxLength) {
      setError(lang === 'ar' ? 'يرجى إدخال اسم العميل.' : 'Please enter a customer name.');
      return;
    }
    if (!contactTrimmed || contactTrimmed.length > VALIDATION_LIMITS.order.customerContactMaxLength) {
      setError(
        lang === 'ar'
          ? 'يرجى إدخال رقم الطاولة أو رقم الجوال.'
          : 'Please enter a table number or phone contact.'
      );
      return;
    }
    if (cartEntries.length === 0) {
      setError(
        lang === 'ar'
          ? 'اختر صنفاً متوفراً واحداً على الأقل قبل إرسال الطلب.'
          : 'Select at least one in-stock menu item before placing an order.'
      );
      return;
    }

    const orderItems: OrderLineItem[] = cartEntries
      .slice(0, VALIDATION_LIMITS.order.maxItems)
      .map((entry) => ({
        itemId: entry.itemId,
        name: entry.name,
        price: entry.price,
        quantity: entry.quantity,
        ...(entry.milkOption ? { milkOption: entry.milkOption } : {}),
        ...(entry.milkExtraPrice ? { milkExtraPrice: entry.milkExtraPrice } : {}),
        ...(entry.temperature ? { temperature: entry.temperature } : {}),
        ...(entry.selectedCustomizations && entry.selectedCustomizations.length > 0
          ? { selectedCustomizations: entry.selectedCustomizations }
          : {}),
        ...(entry.specialInstructions
          ? { specialInstructions: entry.specialInstructions }
          : {}),
      }));

    const orderNumber = `PM-${Math.floor(1000 + Math.random() * 9000)}`;
    setPlacing(true);
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
        orderNumber,
        customerUid: user.uid,
        customerName: nameTrimmed,
        customerContact: contactTrimmed,
        items: orderItems,
        totalBill: Number(totalBill.toFixed(2)),
        status: 'Pending',
        ...(notesTrimmed ? { notes: notesTrimmed } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setLastPlacedOrderId(docRef.id);
      setCart({});
      setCustomerName('');
      setCustomerContact('');
      setNotes('');
    } catch (err) {
      setError(
        lang === 'ar'
          ? 'تعذر إرسال الطلب. تحقق من الاتصال وحاول مجدداً.'
          : 'Unable to submit order. Check your connection and try again.'
      );
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Customer App Domain Link */}
      <div className="bg-white border border-[#E1E5E0] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#6B786F]">{t.customerAppDomainHint}</p>
          <p dir="ltr" className="font-mono text-xs text-[#162019] truncate text-start">
            {CUSTOMER_APP_DOMAIN}
          </p>
        </div>
        <a
          href={CUSTOMER_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t.openLiveCustomerApp}</span>
        </a>
      </div>

      {/* Live Customer Billboard Slider */}
      <section aria-label="Live customer storefront billboard" className="bg-white border border-[#E1E5E0] rounded-2xl overflow-hidden">
        {activeSlide ? (
          <div className="relative aspect-[16/7] min-h-[220px] bg-[#162019]">
            {activeSlide.mediaType === 'video' ? (
              <ResolvedVideo
                key={activeSlide.id}
                src={activeSlide.mediaUrl}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <ResolvedImage
                key={activeSlide.id}
                src={activeSlide.mediaUrl}
                alt={activeSlide.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#162019]/80 via-[#162019]/25 to-transparent" />
            <div className="absolute bottom-0 start-0 end-0 p-5 sm:p-7 flex items-end justify-between gap-4">
              <div className="text-white space-y-1">
                <p className="text-xs font-medium text-[#DCE7DF]">
                  {t.featuredOfferLabel}
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-balance">
                  {activeSlide.title}
                </h2>
              </div>

              {activeBillboards.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label={lang === 'ar' ? 'العرض السابق' : 'Previous offer'}
                    onClick={() =>
                      setSlideIndex((prev) =>
                        (prev - 1 + activeBillboards.length) % activeBillboards.length
                      )
                    }
                    className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label={lang === 'ar' ? 'العرض التالي' : 'Next offer'}
                    onClick={() =>
                      setSlideIndex((prev) => (prev + 1) % activeBillboards.length)
                    }
                    className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-[#E8EFEA] space-y-1">
            <p className="font-display text-sm font-semibold text-[#162019]">
              {t.noActiveBillboard}
            </p>
            <p className="text-xs text-[#4A584F]">
              {t.noActiveBillboardDesc}
            </p>
          </div>
        )}
      </section>

      {/* Menu Selection + Live Order Placement & Status Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-base font-semibold text-[#162019]">
                {t.availableCustomerMenu}
              </h3>
              <span className="text-xs text-[#6B786F] tabular-nums">
                {availableMenu.length} {t.itemsInStockCount}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl overflow-x-auto max-w-full">
              {(['All', ...activeCategoryKeys] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#E8EFEA] text-[#223629]'
                      : 'text-[#4A584F] hover:text-[#162019]'
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          {availableMenu.length === 0 ? (
            <div className="bg-white border border-[#E1E5E0] rounded-xl p-8 text-center text-sm text-[#6B786F]">
              {t.emptyCustomerMenu}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableMenu.map((item) => {
                const displayName = localizedItemName(item);
                const customCfg = productCustomizations[item.id];
                const usesStage04Custom = Boolean(customCfg?.enabled);
                const selectedCustomMap = usesStage04Custom
                  ? getCustomSelectionForItem(item, customCfg!)
                  : {};
                const resolved = resolveItemModifiers(item, categories, coffeeOptions);
                const sel = getSelectionForItem(item);
                const extraPrice = usesStage04Custom
                  ? calculateCustomizationExtraPrice(customCfg!, selectedCustomMap)
                  : resolved.milkEnabled
                  ? getMilkExtraPrice(sel.milkOption, resolved.coconutMilkPrice)
                  : 0;
                const effectivePrice = Number((item.price + extraPrice).toFixed(2));
                const itemCountInCart = cartEntries
                  .filter((e) => e.itemId === item.id)
                  .reduce((sum, e) => sum + e.quantity, 0);

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E1E5E0] rounded-xl p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-lg bg-[#E8EFEA] overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            <ResolvedImage
                              src={item.imageUrl}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Coffee className="w-5 h-5 text-[#4A6B56]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#162019] truncate">
                            {displayName}
                          </p>
                          <p className="text-xs text-[#6B786F] tabular-nums">
                            {categoryLabel(item.category)} ·{' '}
                            <span className="font-mono font-semibold text-[#2C4435]">
                              {formatPrice(effectivePrice)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addConfiguredItemToCart(item)}
                        aria-label={lang === 'ar' ? `إضافة ${displayName}` : `Add ${displayName}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E8EFEA] hover:bg-[#D2DFD6] text-[#223629] text-xs font-medium shrink-0 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.addToOrder}</span>
                        {itemCountInCart > 0 && (
                          <span className="font-mono font-semibold tabular-nums ms-0.5">
                            ({itemCountInCart})
                          </span>
                        )}
                      </button>
                    </div>

                    {usesStage04Custom && customCfg ? (
                      <div className="pt-2.5 border-t border-[#E1E5E0] space-y-2.5">
                        {[...customCfg.groups]
                          .filter((g) => g.enabled)
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((group) => {
                            const chosen = selectedCustomMap[group.id] || [];
                            const groupLabel =
                              lang === 'ar'
                                ? group.nameAr || group.name
                                : group.name || group.nameAr;
                            return (
                              <div key={group.id} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-[#39463D]">
                                    {groupLabel}
                                  </span>
                                  <span className="text-[#6B786F]">
                                    {group.required
                                      ? t.requiredGroupLabel
                                      : t.optionalGroupLabel}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {[...group.options]
                                    .filter((o) => o.enabled)
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map((opt) => {
                                      const active = chosen.includes(opt.id);
                                      const optLabel =
                                        lang === 'ar'
                                          ? opt.nameAr || opt.name
                                          : opt.name || opt.nameAr;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() =>
                                            toggleCustomOption(
                                              item,
                                              customCfg,
                                              group.id,
                                              opt.id
                                            )
                                          }
                                          className={`px-2 py-1 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${
                                            active
                                              ? 'bg-[#2C4435] border-[#2C4435] text-white'
                                              : 'bg-[#F5F6F4] border-[#E1E5E0] text-[#4A584F] hover:text-[#162019]'
                                          }`}
                                        >
                                          {optLabel}
                                          {opt.additionalPrice > 0
                                            ? ` +${formatPrice(opt.additionalPrice)}`
                                            : ''}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })}

                        {customCfg.allowSpecialInstructions && (
                          <input
                            type="text"
                            maxLength={
                              VALIDATION_LIMITS.productCustomization
                                .specialInstructionsMaxLength
                            }
                            value={itemInstructions[item.id] || ''}
                            onChange={(e) =>
                              setItemInstructions((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder={t.specialInstructionsPlaceholder}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-[#F9FAF8] text-[11px] text-[#162019] focus:outline-none focus:border-[#2C4435]"
                          />
                        )}
                      </div>
                    ) : (
                      (resolved.temperatureEnabled || resolved.milkEnabled) && (
                        <div className="pt-2.5 border-t border-[#E1E5E0] space-y-2">
                          {resolved.temperatureEnabled && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-[#6B786F]">
                                {t.temperatureLabel}
                              </span>
                              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#F5F6F4] border border-[#E1E5E0]">
                                {(['Hot', 'Cold'] as const).map((temp) => (
                                  <button
                                    key={temp}
                                    type="button"
                                    onClick={() =>
                                      setItemSelection(item, { temperature: temp })
                                    }
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                                      sel.temperature === temp
                                        ? 'bg-[#2C4435] text-white'
                                        : 'text-[#4A584F] hover:text-[#162019]'
                                    }`}
                                  >
                                    {temp === 'Hot' ? t.tempHot : t.tempCold}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {resolved.milkEnabled && (
                            <div className="space-y-1">
                              <span className="block text-[11px] font-medium text-[#6B786F]">
                                {t.milkOptionLabel}
                              </span>
                              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#F5F6F4] border border-[#E1E5E0]">
                                {(
                                  [
                                    { id: 'none', label: t.milkNone },
                                    { id: 'regular', label: t.milkRegular },
                                    {
                                      id: 'coconut',
                                      label:
                                        resolved.coconutMilkPrice > 0
                                          ? `${t.milkCoconut} +${formatPrice(resolved.coconutMilkPrice)}`
                                          : t.milkCoconut,
                                    },
                                  ] as const
                                ).map((milk) => (
                                  <button
                                    key={milk.id}
                                    type="button"
                                    onClick={() =>
                                      setItemSelection(item, { milkOption: milk.id })
                                    }
                                    className={`px-1.5 py-1 rounded-md text-[11px] font-medium text-center leading-tight cursor-pointer transition-colors ${
                                      sel.milkOption === milk.id
                                        ? 'bg-[#2C4435] text-white'
                                        : 'text-[#4A584F] hover:text-[#162019]'
                                    }`}
                                  >
                                    {milk.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right/End Column: Order Checkout & Live Status Tracker */}
        <div className="space-y-4">
          <form
            onSubmit={handlePlaceOrder}
            className="bg-white border border-[#E1E5E0] rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[#162019]">
                {t.placeTestOrder}
              </h3>
              <ShoppingBag className="w-4 h-4 text-[#2C4435]" />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <input
                type="text"
                required
                maxLength={VALIDATION_LIMITS.order.customerNameMaxLength}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t.customerNamePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
              <input
                type="text"
                required
                maxLength={VALIDATION_LIMITS.order.customerContactMaxLength}
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder={t.customerContactPlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
              <input
                type="text"
                maxLength={VALIDATION_LIMITS.order.notesMaxLength}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.prepNotePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
            </div>

            <div className="pt-2 border-t border-[#E1E5E0] space-y-2">
              {cartEntries.length === 0 ? (
                <p className="text-xs text-[#6B786F]">{t.noItemsSelected}</p>
              ) : (
                cartEntries.map((line) => {
                  const customSummary = line.selectedCustomizations?.length
                    ? line.selectedCustomizations
                        .map((sel) => {
                          const label =
                            lang === 'ar'
                              ? sel.optionNameAr || sel.optionName
                              : sel.optionName || sel.optionNameAr || '';
                          return sel.additionalPrice > 0
                            ? `${label} (+${formatPrice(sel.additionalPrice)})`
                            : label;
                        })
                        .join(' · ')
                    : '';
                  const modSummary =
                    customSummary ||
                    formatModifierSummary(
                      line.temperature,
                      line.milkOption,
                      line.milkExtraPrice
                    );
                  return (
                    <div
                      key={line.key}
                      className="flex items-start justify-between gap-2 text-xs text-[#39463D] tabular-nums"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#162019]">
                          {line.quantity}×{' '}
                          {localizedItemName({
                            id: line.itemId,
                            name: line.name,
                            nameAr: line.nameAr,
                          })}
                        </p>
                        {modSummary && (
                          <p className="text-[11px] text-[#6B786F]">{modSummary}</p>
                        )}
                        {line.specialInstructions && (
                          <p className="text-[11px] text-[#4A6B56]">
                            {t.specialInstructionsPrefix} {line.specialInstructions}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartEntryQty(line.key, -1)}
                          aria-label={lang === 'ar' ? 'إنقاص الكمية' : 'Decrease quantity'}
                          className="w-5 h-5 rounded border border-[#E1E5E0] flex items-center justify-center hover:bg-[#F5F6F4] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCartEntryQty(line.key, 1)}
                          aria-label={lang === 'ar' ? 'زيادة الكمية' : 'Increase quantity'}
                          className="w-5 h-5 rounded border border-[#E1E5E0] flex items-center justify-center hover:bg-[#F5F6F4] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-mono w-14 text-end">
                          {formatPrice(line.price * line.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-[#E1E5E0]">
                <span className="text-xs font-medium text-[#6B786F]">{t.totalWord}</span>
                <span className="font-mono text-lg font-semibold text-[#162019] tabular-nums">
                  {formatPrice(totalBill)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={placing || cartEntries.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {placing ? t.sendingOrder : t.submitOrderKitchen}
            </button>

            {lastPlacedOrderId && (
              <div className="pt-1 flex items-center justify-between text-xs text-[#2C4435]">
                <span>{t.orderSyncedMsg}</span>
                <button
                  type="button"
                  onClick={onOrderPlaced}
                  className="font-medium underline cursor-pointer"
                >
                  {t.viewInLiveOrders}
                </button>
              </div>
            )}
          </form>

          {/* Live Customer Order Status Tracker */}
          {recentCustomerOrders.length > 0 && (
            <div className="bg-white border border-[#E1E5E0] rounded-xl p-5 space-y-3">
              <h4 className="font-display text-sm font-semibold text-[#162019]">
                {t.liveCustomerStatusSync}
              </h4>
              <div className="space-y-3 divide-y divide-[#E1E5E0]">
                {recentCustomerOrders.map((order) => (
                  <div key={order.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span dir="ltr" className="font-mono font-semibold text-[#162019]">
                        #{order.orderNumber}
                      </span>
                      <span className="font-medium text-[#2C4435]">{statusLabel(order.status)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {ORDER_STATUSES.map((step, idx) => {
                        const currentIdx = ORDER_STATUSES.indexOf(order.status);
                        const reached = idx <= currentIdx;
                        return (
                          <div key={step} className="space-y-1">
                            <div
                              className={`h-1.5 rounded-full transition-colors ${
                                reached ? 'bg-[#2C4435]' : 'bg-[#E1E5E0]'
                              }`}
                            />
                            <p className="text-[11px] text-[#6B786F] truncate">{statusLabel(step)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
