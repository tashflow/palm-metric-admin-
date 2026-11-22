import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Coffee,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import {
  CustomizationValidationError,
  createDefaultCustomizationForProduct,
  createEmptyCustomizationForProduct,
  createExtrasTemplateGroup,
  createMilkTemplateGroup,
  createSizeTemplateGroup,
  createTemperatureTemplateGroup,
  normalizeCustomizationConfig,
  sanitizeFirestoreCustomization,
  slugifyCustomizationId,
  validateProductCustomization,
} from '../lib/productCustomizations';
import {
  CategoryItem,
  CoffeeOptionsSettings,
  CustomizationGroup,
  CustomizationOption,
  MenuItem,
  ProductCustomization,
  VALIDATION_LIMITS,
  formatPrice,
} from '../types';
import { CustomizationCustomerPreview } from './CustomizationCustomerPreview';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';
import { ResolvedImage } from './ResolvedMedia';

interface ProductCustomizationsViewProps {
  menuItems: MenuItem[];
  categories: CategoryItem[];
  coffeeOptions: CoffeeOptionsSettings;
  customizationsMap: Record<string, ProductCustomization>;
  initialProductId?: string | null;
  rulesUpdateRequired?: boolean;
  loading?: boolean;
}

const LIMITS = VALIDATION_LIMITS.productCustomization;

function makeUniqueGroupId(
  preferredId: string,
  existingGroups: CustomizationGroup[]
): string {
  const existing = new Set(existingGroups.map((g) => g.id));
  if (!existing.has(preferredId)) return preferredId;
  let counter = 2;
  while (existing.has(`${preferredId}-${counter}`)) {
    counter += 1;
  }
  return `${preferredId}-${counter}`;
}

export function ProductCustomizationsView({
  menuItems,
  categories,
  coffeeOptions,
  customizationsMap,
  initialProductId = null,
  rulesUpdateRequired = false,
  loading = false,
}: ProductCustomizationsViewProps) {
  const { user } = useAuth();
  const { lang, t, categoryLabel, localizedItemName } = useLanguage();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    () => initialProductId || menuItems[0]?.id || ''
  );
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('All');
  const [configFilter, setConfigFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');

  const [draft, setDraft] = useState<ProductCustomization | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<CustomizationValidationError[]>([]);
  const [localRulesBlocked, setLocalRulesBlocked] = useState(false);

  // Respect navigation from Menu Catalog "Customize" button
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  // Fallback selection when menuItems loads asynchronously
  useEffect(() => {
    if (!selectedProductId && menuItems.length > 0) {
      setSelectedProductId(menuItems[0].id);
    } else if (
      selectedProductId &&
      menuItems.length > 0 &&
      !menuItems.some((item) => item.id === selectedProductId)
    ) {
      setSelectedProductId(menuItems[0].id);
    }
  }, [menuItems, selectedProductId]);

  const selectedProduct = useMemo(
    () => menuItems.find((item) => item.id === selectedProductId) || null,
    [menuItems, selectedProductId]
  );

  // Sync draft when product switches or Firestore updates while editor is clean
  const savedConfig = selectedProductId ? customizationsMap[selectedProductId] : undefined;

  useEffect(() => {
    if (!selectedProduct) {
      setDraft(null);
      setIsDirty(false);
      return;
    }

    if (isDirty) return;

    if (savedConfig) {
      setDraft(structuredClone(savedConfig));
    } else {
      setDraft(createEmptyCustomizationForProduct(selectedProduct.id, user?.uid || ''));
    }
    setValidationErrors([]);
    setSaveError(null);
  }, [selectedProduct?.id, savedConfig, isDirty, user?.uid]);

  // Reset dirty flag only when explicitly switching products
  const handleSelectProduct = (productId: string) => {
    if (productId === selectedProductId) return;
    setSelectedProductId(productId);
    setIsDirty(false);
    setSaveSuccess(null);
    setSaveError(null);
    setValidationErrors([]);

    const targetItem = menuItems.find((m) => m.id === productId);
    const existingCfg = customizationsMap[productId];
    if (existingCfg) {
      setDraft(structuredClone(existingCfg));
    } else if (targetItem) {
      setDraft(createEmptyCustomizationForProduct(targetItem.id, user?.uid || ''));
    }
  };

  const orderedCategoryKeys = useMemo(() => {
    const keys = [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.key);
    for (const item of menuItems) {
      if (item.category && !keys.includes(item.category)) {
        keys.push(item.category);
      }
    }
    return keys;
  }, [categories, menuItems]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (productCategoryFilter !== 'All' && item.category !== productCategoryFilter) {
        return false;
      }
      const hasConfig = Boolean(customizationsMap[item.id]);
      if (configFilter === 'configured' && !hasConfig) return false;
      if (configFilter === 'unconfigured' && hasConfig) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        localizedItemName(item).toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [
    menuItems,
    productSearch,
    productCategoryFilter,
    configFilter,
    customizationsMap,
    localizedItemName,
  ]);

  const updateDraft = (updater: (prev: ProductCustomization) => ProductCustomization) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setIsDirty(true);
    setSaveSuccess(null);
    setSaveError(null);
    setValidationErrors([]);
  };

  const handleToggleMasterEnabled = () => {
    if (!draft || !selectedProduct) return;
    const nextEnabled = !draft.enabled;
    updateDraft((prev) => {
      if (nextEnabled && prev.groups.length === 0 && !customizationsMap[selectedProduct.id]) {
        const starter = createDefaultCustomizationForProduct(
          selectedProduct,
          user?.uid || ''
        );
        return {
          ...prev,
          enabled: true,
          groups: starter.groups,
        };
      }
      return {
        ...prev,
        enabled: nextEnabled,
      };
    });
  };

  const handleAddGroupFromTemplate = (template: CustomizationGroup) => {
    updateDraft((prev) => {
      if (prev.groups.length >= LIMITS.maxGroups) return prev;
      const uniqueId = makeUniqueGroupId(template.id, prev.groups);
      return {
        ...prev,
        enabled: true,
        groups: [
          ...prev.groups,
          {
            ...template,
            id: uniqueId,
            displayOrder: prev.groups.length + 1,
          },
        ],
      };
    });
  };

  const handleAddEmptyGroup = () => {
    updateDraft((prev) => {
      if (prev.groups.length >= LIMITS.maxGroups) return prev;
      const nextIndex = prev.groups.length + 1;
      const newGroup: CustomizationGroup = {
        id: makeUniqueGroupId(`group-${nextIndex}`, prev.groups),
        name: `Option Group ${nextIndex}`,
        nameAr: `مجموعة خيارات ${nextIndex}`,
        type: 'single',
        required: false,
        minSelections: 0,
        maxSelections: 1,
        displayOrder: nextIndex,
        enabled: true,
        options: [
          {
            id: 'option-1',
            name: 'Standard',
            nameAr: 'عادي',
            additionalPrice: 0,
            enabled: true,
            isDefault: true,
            displayOrder: 1,
          },
        ],
      };
      return {
        ...prev,
        enabled: true,
        groups: [...prev.groups, newGroup],
      };
    });
  };

  const handleUpdateGroup = (
    groupIndex: number,
    patch: Partial<CustomizationGroup>
  ) => {
    updateDraft((prev) => {
      const nextGroups = prev.groups.map((g, idx) => {
        if (idx !== groupIndex) return g;
        const merged = { ...g, ...patch };
        if (merged.type === 'single') {
          merged.maxSelections = 1;
          merged.minSelections = merged.required ? 1 : 0;
          let foundDefault = false;
          merged.options = merged.options.map((opt) => {
            if (!opt.isDefault) return opt;
            if (!foundDefault && opt.enabled) {
              foundDefault = true;
              return opt;
            }
            return { ...opt, isDefault: false };
          });
        } else {
          if (merged.maxSelections < 1) merged.maxSelections = 1;
          if (merged.required && merged.minSelections < 1) {
            merged.minSelections = 1;
          }
          if (merged.minSelections > merged.maxSelections) {
            merged.maxSelections = merged.minSelections;
          }
        }
        return merged;
      });
      return { ...prev, groups: nextGroups };
    });
  };

  const handleMoveGroup = (groupIndex: number, direction: -1 | 1) => {
    updateDraft((prev) => {
      const targetIndex = groupIndex + direction;
      if (targetIndex < 0 || targetIndex >= prev.groups.length) return prev;
      const next = [...prev.groups];
      const [moved] = next.splice(groupIndex, 1);
      next.splice(targetIndex, 0, moved);
      return {
        ...prev,
        groups: next.map((g, i) => ({ ...g, displayOrder: i + 1 })),
      };
    });
  };

  const handleDeleteGroup = (groupIndex: number) => {
    updateDraft((prev) => {
      const next = prev.groups
        .filter((_, idx) => idx !== groupIndex)
        .map((g, i) => ({ ...g, displayOrder: i + 1 }));
      return { ...prev, groups: next };
    });
  };

  const handleAddOption = (groupIndex: number) => {
    updateDraft((prev) => {
      const nextGroups = prev.groups.map((g, idx) => {
        if (idx !== groupIndex || g.options.length >= LIMITS.maxOptionsPerGroup) return g;
        const existingIds = new Set(g.options.map((o) => o.id));
        let num = g.options.length + 1;
        while (existingIds.has(`option-${num}`)) {
          num += 1;
        }
        const newOpt: CustomizationOption = {
          id: `option-${num}`,
          name: `Option ${num}`,
          nameAr: `خيار ${num}`,
          additionalPrice: 0,
          enabled: true,
          isDefault: false,
          displayOrder: g.options.length + 1,
        };
        return {
          ...g,
          options: [...g.options, newOpt],
        };
      });
      return { ...prev, groups: nextGroups };
    });
  };

  const handleUpdateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<CustomizationOption>
  ) => {
    updateDraft((prev) => {
      const nextGroups = prev.groups.map((g, gIdx) => {
        if (gIdx !== groupIndex) return g;
        const nextOptions = g.options.map((opt, oIdx) => {
          if (oIdx === optionIndex) {
            const merged = { ...opt, ...patch };
            if (!merged.enabled) {
              merged.isDefault = false;
            }
            return merged;
          }
          // In single-select mode, setting one option as default clears others
          if (patch.isDefault === true && g.type === 'single') {
            return { ...opt, isDefault: false };
          }
          return opt;
        });
        return { ...g, options: nextOptions };
      });
      return { ...prev, groups: nextGroups };
    });
  };

  const handleMoveOption = (
    groupIndex: number,
    optionIndex: number,
    direction: -1 | 1
  ) => {
    updateDraft((prev) => {
      const nextGroups = prev.groups.map((g, gIdx) => {
        if (gIdx !== groupIndex) return g;
        const targetIndex = optionIndex + direction;
        if (targetIndex < 0 || targetIndex >= g.options.length) return g;
        const copy = [...g.options];
        const [moved] = copy.splice(optionIndex, 1);
        copy.splice(targetIndex, 0, moved);
        return {
          ...g,
          options: copy.map((o, i) => ({ ...o, displayOrder: i + 1 })),
        };
      });
      return { ...prev, groups: nextGroups };
    });
  };

  const handleDeleteOption = (groupIndex: number, optionIndex: number) => {
    updateDraft((prev) => {
      const nextGroups = prev.groups.map((g, gIdx) => {
        if (gIdx !== groupIndex) return g;
        return {
          ...g,
          options: g.options
            .filter((_, oIdx) => oIdx !== optionIndex)
            .map((o, i) => ({ ...o, displayOrder: i + 1 })),
        };
      });
      return { ...prev, groups: nextGroups };
    });
  };

  const handleReloadFromFirestore = async () => {
    if (!selectedProduct) return;
    setReloading(true);
    setSaveError(null);
    setSaveSuccess(null);
    setValidationErrors([]);

    try {
      const snap = await getDoc(doc(db, 'productCustomizations', selectedProduct.id));
      if (snap.exists()) {
        setDraft(
          sanitizeFirestoreCustomization(
            snap.id,
            snap.data() as Record<string, unknown>
          )
        );
      } else {
        setDraft(createEmptyCustomizationForProduct(selectedProduct.id, user?.uid || ''));
      }
      setIsDirty(false);
      setLocalRulesBlocked(false);
      setSaveSuccess(t.customizationReloadedMsg);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'permission-denied') {
        setLocalRulesBlocked(true);
      }
      setSaveError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذرت إعادة التحميل من Firestore.'
          : 'Unable to reload configuration from Firestore.'
      );
    } finally {
      setReloading(false);
    }
  };

  const handleSave = async () => {
    if (!draft || !selectedProduct || !user) return;
    setSaveError(null);
    setSaveSuccess(null);

    const draftValidation = validateProductCustomization(draft);
    if (!draftValidation.valid) {
      setValidationErrors(draftValidation.errors);
      return;
    }

    const normalized = normalizeCustomizationConfig(draft, user.uid);
    const validation = validateProductCustomization(normalized);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    setSaving(true);
    try {
      await setDoc(doc(db, 'productCustomizations', selectedProduct.id), {
        ...normalized,
        updatedAt: serverTimestamp(),
      });
      setDraft(normalized);
      setIsDirty(false);
      setLocalRulesBlocked(false);
      setSaveSuccess(t.customizationSavedMsg);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : String(err);
      if (code === 'permission-denied' || msg.toLowerCase().includes('insufficient permissions')) {
        setLocalRulesBlocked(true);
        setSaveError(
          lang === 'ar'
            ? 'تعذر الحفظ لأن قواعد Firestore في palm-metric-app لا تتضمن مجموعة productCustomizations بعد. انسخ القواعد المحدّثة أدناه وراجعها قبل النشر.'
            : 'Save blocked because Firestore rules in palm-metric-app have not been updated for productCustomizations yet. Review and publish the updated rules.'
        );
      } else {
        setSaveError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'تعذر حفظ إعدادات التخصيص.'
            : 'Failed to save product customization.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {(rulesUpdateRequired || localRulesBlocked) && <FirestoreRulesNotice />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Product Selector Column */}
        <section className="lg:col-span-4 bg-white border border-[#E1E5E0] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#E1E5E0] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-[#162019]">
                {t.productCustomizationsTab}
              </h2>
              <span className="font-mono text-xs text-[#6B786F] tabular-nums">
                {menuItems.length}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B786F] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t.searchProductsPlaceholder}
                className="w-full ps-8 pe-3 py-1.5 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] text-xs text-[#162019] placeholder:text-[#89948C] focus:outline-none focus:border-[#2C4435]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                aria-label={t.categoryLabel}
                className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
              >
                <option value="All">{categoryLabel('All')}</option>
                {orderedCategoryKeys.map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {categoryLabel(catKey)}
                  </option>
                ))}
              </select>

              <select
                value={configFilter}
                onChange={(e) =>
                  setConfigFilter(e.target.value as 'all' | 'configured' | 'unconfigured')
                }
                aria-label={t.customizationsTitle}
                className="px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
              >
                <option value="all">{t.filterAllProducts}</option>
                <option value="configured">{t.filterCustomizedOnly}</option>
                <option value="unconfigured">{t.filterNotConfigured}</option>
              </select>
            </div>
          </div>

          <div className="max-h-[420px] lg:max-h-[680px] overflow-y-auto divide-y divide-[#E1E5E0]">
            {loading ? (
              <div className="p-6 text-center text-xs text-[#6B786F]">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1.5 text-[#2C4435]" />
                <span>{t.reloadingFromFirestore}</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B786F]">
                {t.noMatchingMenuTitle}
              </div>
            ) : (
              filteredProducts.map((item) => {
                const cfg = customizationsMap[item.id];
                const isSelected = item.id === selectedProductId;
                const statusText = cfg
                  ? cfg.enabled
                    ? `${t.customizationsActiveLabel} · ${cfg.groups.length} ${t.groupsCountWord}`
                    : `${t.customizationsDisabledLabel} · ${cfg.groups.length} ${t.groupsCountWord}`
                  : t.customizationsNotConfiguredLabel;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProduct(item.id)}
                    className={`w-full p-3 flex items-center gap-3 text-start transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E8EFEA] border-s-2 border-s-[#2C4435]'
                        : 'hover:bg-[#F9FAF8]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg bg-[#E8EFEA] border border-[#E1E5E0] overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <ResolvedImage
                          src={item.imageUrl}
                          alt={localizedItemName(item)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Coffee className="w-4 h-4 text-[#4A6B56]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#162019] truncate">
                          {localizedItemName(item)}
                        </span>
                        <span className="font-mono text-[11px] font-medium text-[#2C4435] tabular-nums shrink-0">
                          {formatPrice(item.price)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B786F] truncate">
                        {categoryLabel(item.category)} ·{' '}
                        <span
                          className={
                            cfg?.enabled
                              ? 'text-[#2C4435] font-medium'
                              : cfg
                              ? 'text-[#92400E]'
                              : 'text-[#89948C]'
                          }
                        >
                          {statusText}
                        </span>
                      </p>
                      <p dir="ltr" className="font-mono text-[10px] text-[#89948C] truncate text-start">
                        {item.id}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Main Editor & Preview Area */}
        <section className="lg:col-span-8 space-y-4">
          {!selectedProduct || !draft ? (
            <div className="bg-white border border-[#E1E5E0] rounded-xl p-10 text-center space-y-2">
              <SlidersHorizontal className="w-6 h-6 text-[#2C4435] mx-auto opacity-80" />
              <p className="text-sm font-medium text-[#162019]">{t.selectProductHint}</p>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div className="bg-white border border-[#E1E5E0] rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold text-[#162019] truncate">
                        {localizedItemName(selectedProduct)}
                      </h2>
                      <span
                        dir="ltr"
                        className="font-mono text-xs text-[#6B786F] truncate"
                      >
                        productCustomizations/{selectedProduct.id}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B786F]">{t.customizationsSubtitle}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPreview((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E1E5E0] bg-white hover:bg-[#F5F6F4] text-xs font-medium text-[#39463D] cursor-pointer transition-colors"
                    >
                      {showPreview ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>{showPreview ? t.hideLivePreview : t.showLivePreview}</span>
                    </button>

                    <button
                      type="button"
                      disabled={reloading || saving}
                      onClick={handleReloadFromFirestore}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#162019] cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-[#2C4435] ${
                          reloading ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {reloading ? t.reloadingFromFirestore : t.reloadFromFirestore}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={saving || reloading}
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{saving ? t.savingCustomization : t.saveCustomization}</span>
                    </button>
                  </div>
                </div>

                {/* Master Toggles & Dirty Indicator */}
                <div className="pt-3 border-t border-[#E1E5E0] grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleToggleMasterEnabled}
                    aria-pressed={draft.enabled}
                    className="p-3 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] hover:border-[#BFCAC2] flex items-start justify-between gap-3 text-start cursor-pointer transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#162019]">
                        {t.enableCustomizationLabel}
                      </p>
                      <p className="text-[11px] text-[#6B786F] leading-relaxed">
                        {t.enableCustomizationHint}
                      </p>
                    </div>
                    <span
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 mt-0.5 ${
                        draft.enabled ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          draft.enabled ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((prev) => ({
                        ...prev,
                        allowSpecialInstructions: !prev.allowSpecialInstructions,
                      }))
                    }
                    aria-pressed={draft.allowSpecialInstructions}
                    className="p-3 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] hover:border-[#BFCAC2] flex items-start justify-between gap-3 text-start cursor-pointer transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#162019]">
                        {t.allowSpecialInstructionsLabel}
                      </p>
                      <p className="text-[11px] text-[#6B786F] leading-relaxed">
                        {t.allowSpecialInstructionsHint}
                      </p>
                    </div>
                    <span
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 mt-0.5 ${
                        draft.allowSpecialInstructions ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          draft.allowSpecialInstructions
                            ? 'translate-x-4 rtl:-translate-x-4'
                            : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                {/* Status Banners */}
                {isDirty && !saveSuccess && (
                  <p className="text-xs font-medium text-[#92400E]">
                    · {t.unsavedChangesHint}
                  </p>
                )}

                {saveSuccess && (
                  <div className="p-3 rounded-xl bg-[#E8EFEA] border border-[#B6C7BC] text-xs text-[#223629] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2C4435]" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {saveError && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{saveError}</span>
                  </div>
                )}

                {validationErrors.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] space-y-1">
                    {validationErrors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{lang === 'ar' ? err.ar : err.en}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editor + Optional Side Preview */}
              <div
                className={`grid grid-cols-1 gap-5 items-start ${
                  showPreview ? 'xl:grid-cols-12' : ''
                }`}
              >
                <div className={`${showPreview ? 'xl:col-span-7' : ''} space-y-4`}>
                  {/* Templates & Add Group Bar */}
                  <div className="bg-white border border-[#E1E5E0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-[#6B786F] me-1">
                        {t.quickTemplatesLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddGroupFromTemplate(
                            createMilkTemplateGroup(
                              selectedProduct.coconutMilkPrice ??
                                coffeeOptions.coconutMilkExtraPrice ??
                                3
                            )
                          )
                        }
                        className="px-2.5 py-1 rounded-lg border border-[#CBD4CD] bg-[#F9FAF8] hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] cursor-pointer transition-colors"
                      >
                        {t.templateMilk}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddGroupFromTemplate(createTemperatureTemplateGroup())
                        }
                        className="px-2.5 py-1 rounded-lg border border-[#CBD4CD] bg-[#F9FAF8] hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] cursor-pointer transition-colors"
                      >
                        {t.templateTemperature}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddGroupFromTemplate(createSizeTemplateGroup())}
                        className="px-2.5 py-1 rounded-lg border border-[#CBD4CD] bg-[#F9FAF8] hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] cursor-pointer transition-colors"
                      >
                        {t.templateSize}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddGroupFromTemplate(createExtrasTemplateGroup())
                        }
                        className="px-2.5 py-1 rounded-lg border border-[#CBD4CD] bg-[#F9FAF8] hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] cursor-pointer transition-colors"
                      >
                        {t.templateExtras}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={draft.groups.length >= LIMITS.maxGroups}
                      onClick={handleAddEmptyGroup}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-50 text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addGroupBtn}</span>
                    </button>
                  </div>

                  {/* Groups List */}
                  {draft.groups.length === 0 ? (
                    <div className="bg-white border border-dashed border-[#CBD4CD] rounded-xl p-8 text-center space-y-3">
                      <SlidersHorizontal className="w-6 h-6 text-[#4A6B56] mx-auto" />
                      <div className="space-y-1 max-w-sm mx-auto">
                        <h3 className="font-display text-sm font-semibold text-[#162019]">
                          {t.noGroupsTitle}
                        </h3>
                        <p className="text-xs text-[#6B786F]">{t.noGroupsDesc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddEmptyGroup}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.addGroupBtn}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {draft.groups.map((group, gIdx) => (
                        <div
                          key={`${group.id}-${gIdx}`}
                          className={`bg-white border rounded-xl overflow-hidden ${
                            group.enabled
                              ? 'border-[#E1E5E0]'
                              : 'border-[#E1E5E0] opacity-80 bg-[#F9FAF8]'
                          }`}
                        >
                          {/* Group Header */}
                          <div className="px-4 py-3 border-b border-[#E1E5E0] bg-[#F9FAF8] flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs font-semibold text-[#2C4435] tabular-nums">
                                #{gIdx + 1}
                              </span>
                              <span className="text-xs font-semibold text-[#162019] truncate">
                                {lang === 'ar'
                                  ? group.nameAr || group.name
                                  : group.name || group.nameAr}
                              </span>
                              <span className="text-[11px] text-[#6B786F] tabular-nums">
                                · {group.options.length} {t.optionsCountWord}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateGroup(gIdx, { enabled: !group.enabled })
                                }
                                className={`px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors ${
                                  group.enabled
                                    ? 'bg-[#E8EFEA] text-[#223629]'
                                    : 'bg-[#E1E5E0] text-[#4A584F]'
                                }`}
                              >
                                {group.enabled ? t.enabledWord : t.disabledWord}
                              </button>
                              <button
                                type="button"
                                disabled={gIdx === 0}
                                onClick={() => handleMoveGroup(gIdx, -1)}
                                aria-label={t.moveUp}
                                title={t.moveUp}
                                className="p-1.5 rounded-lg text-[#4A584F] hover:bg-[#E8EFEA] disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={gIdx === draft.groups.length - 1}
                                onClick={() => handleMoveGroup(gIdx, 1)}
                                aria-label={t.moveDown}
                                title={t.moveDown}
                                className="p-1.5 rounded-lg text-[#4A584F] hover:bg-[#E8EFEA] disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroup(gIdx)}
                                aria-label={t.deleteGroupBtn}
                                title={t.deleteGroupBtn}
                                className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Group Fields */}
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.groupNameEnLabel}
                                </label>
                                <input
                                  type="text"
                                  dir="ltr"
                                  maxLength={LIMITS.nameMaxLength}
                                  value={group.name}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, { name: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.groupNameArLabel}
                                </label>
                                <input
                                  type="text"
                                  dir="rtl"
                                  maxLength={LIMITS.nameMaxLength}
                                  value={group.nameAr}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, { nameAr: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.groupIdLabel}
                                </label>
                                <input
                                  type="text"
                                  dir="ltr"
                                  maxLength={LIMITS.idMaxLength}
                                  value={group.id}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, {
                                      id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                                    })
                                  }
                                  onBlur={(e) => {
                                    if (!e.target.value.trim()) {
                                      handleUpdateGroup(gIdx, {
                                        id: slugifyCustomizationId(group.name, 'group'),
                                      });
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-[#F9FAF8] font-mono text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                />
                              </div>
                            </div>

                            {/* Rules: Type, Required, Min, Max */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.selectionTypeLabel}
                                </label>
                                <select
                                  value={group.type}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, {
                                      type: e.target.value as 'single' | 'multiple',
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                >
                                  <option value="single">{t.singleSelectLabel}</option>
                                  <option value="multiple">{t.multipleSelectLabel}</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[11px] font-medium text-[#39463D]">
                                  {t.requiredGroupLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateGroup(gIdx, { required: !group.required })
                                  }
                                  className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                    group.required
                                      ? 'bg-[#E8EFEA] border-[#2C4435] text-[#223629]'
                                      : 'bg-white border-[#E1E5E0] text-[#4A584F]'
                                  }`}
                                >
                                  {group.required
                                    ? t.requiredGroupLabel
                                    : t.optionalGroupLabel}
                                </button>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.minSelectionsLabel}
                                </label>
                                <input
                                  type="number"
                                  min={group.required ? 1 : 0}
                                  max={group.type === 'single' ? 1 : LIMITS.maxOptionsPerGroup}
                                  value={group.minSelections}
                                  disabled={group.type === 'single'}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, {
                                      minSelections: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white font-mono text-xs tabular-nums text-[#162019] disabled:bg-[#F5F6F4] focus:outline-none focus:border-[#2C4435]"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-[#39463D]">
                                  {t.maxSelectionsLabel}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={group.type === 'single' ? 1 : LIMITS.maxOptionsPerGroup}
                                  value={group.maxSelections}
                                  disabled={group.type === 'single'}
                                  onChange={(e) =>
                                    handleUpdateGroup(gIdx, {
                                      maxSelections: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white font-mono text-xs tabular-nums text-[#162019] disabled:bg-[#F5F6F4] focus:outline-none focus:border-[#2C4435]"
                                />
                              </div>
                            </div>

                            {/* Options List */}
                            <div className="pt-2 border-t border-[#E1E5E0] space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#162019]">
                                  {t.optionsListLabel}
                                </span>
                                <button
                                  type="button"
                                  disabled={group.options.length >= LIMITS.maxOptionsPerGroup}
                                  onClick={() => handleAddOption(gIdx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] cursor-pointer disabled:opacity-50"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{t.addOptionBtn}</span>
                                </button>
                              </div>

                              <div className="space-y-2">
                                {group.options.map((opt, oIdx) => (
                                  <div
                                    key={`${opt.id}-${oIdx}`}
                                    className={`p-3 rounded-xl border space-y-2.5 ${
                                      opt.enabled
                                        ? 'border-[#E1E5E0] bg-[#F9FAF8]'
                                        : 'border-[#E1E5E0] bg-[#F5F6F4] opacity-75'
                                    }`}
                                  >
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                      <div className="sm:col-span-4 space-y-1">
                                        <label className="block text-[10px] font-medium text-[#4A584F]">
                                          {t.optionNameEnLabel}
                                        </label>
                                        <input
                                          type="text"
                                          dir="ltr"
                                          maxLength={LIMITS.nameMaxLength}
                                          value={opt.name}
                                          onChange={(e) =>
                                            handleUpdateOption(gIdx, oIdx, {
                                              name: e.target.value,
                                            })
                                          }
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                        />
                                      </div>

                                      <div className="sm:col-span-4 space-y-1">
                                        <label className="block text-[10px] font-medium text-[#4A584F]">
                                          {t.optionNameArLabel}
                                        </label>
                                        <input
                                          type="text"
                                          dir="rtl"
                                          maxLength={LIMITS.nameMaxLength}
                                          value={opt.nameAr}
                                          onChange={(e) =>
                                            handleUpdateOption(gIdx, oIdx, {
                                              nameAr: e.target.value,
                                            })
                                          }
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                        />
                                      </div>

                                      <div className="sm:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-medium text-[#4A584F]">
                                          {t.additionalPriceSarLabel}
                                        </label>
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          max={LIMITS.maxAdditionalPrice}
                                          value={opt.additionalPrice}
                                          onChange={(e) =>
                                            handleUpdateOption(gIdx, oIdx, {
                                              additionalPrice: Math.max(
                                                0,
                                                Number(e.target.value) || 0
                                              ),
                                            })
                                          }
                                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1E5E0] bg-white font-mono text-xs tabular-nums text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                        />
                                      </div>

                                      <div className="sm:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-medium text-[#4A584F]">
                                          {t.optionIdLabel}
                                        </label>
                                        <input
                                          type="text"
                                          dir="ltr"
                                          maxLength={LIMITS.idMaxLength}
                                          value={opt.id}
                                          onChange={(e) =>
                                            handleUpdateOption(gIdx, oIdx, {
                                              id: e.target.value.replace(
                                                /[^a-zA-Z0-9_-]/g,
                                                ''
                                              ),
                                            })
                                          }
                                          className="w-full px-2 py-1.5 rounded-lg border border-[#E1E5E0] bg-white font-mono text-[11px] text-[#162019] focus:outline-none focus:border-[#2C4435]"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#39463D] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={opt.isDefault}
                                            disabled={!opt.enabled}
                                            onChange={(e) =>
                                              handleUpdateOption(gIdx, oIdx, {
                                                isDefault: e.target.checked,
                                              })
                                            }
                                            className="accent-[#2C4435]"
                                          />
                                          <span>{t.defaultOptionLabel}</span>
                                        </label>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateOption(gIdx, oIdx, {
                                              enabled: !opt.enabled,
                                            })
                                          }
                                          className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                                            opt.enabled
                                              ? 'bg-[#E8EFEA] text-[#223629]'
                                              : 'bg-[#E1E5E0] text-[#4A584F]'
                                          }`}
                                        >
                                          {opt.enabled ? t.enabledWord : t.disabledWord}
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={oIdx === 0}
                                          onClick={() => handleMoveOption(gIdx, oIdx, -1)}
                                          aria-label={t.moveUp}
                                          className="p-1 rounded text-[#4A584F] hover:bg-[#E8EFEA] disabled:opacity-35 cursor-pointer"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={oIdx === group.options.length - 1}
                                          onClick={() => handleMoveOption(gIdx, oIdx, 1)}
                                          aria-label={t.moveDown}
                                          className="p-1 rounded text-[#4A584F] hover:bg-[#E8EFEA] disabled:opacity-35 cursor-pointer"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOption(gIdx, oIdx)}
                                          aria-label={t.deleteOptionBtn}
                                          className="p-1 rounded text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {showPreview && (
                  <div className="xl:col-span-5 xl:sticky xl:top-20">
                    <CustomizationCustomerPreview
                      product={selectedProduct}
                      config={draft}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
