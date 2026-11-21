import React, { useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Coffee,
  Copy,
  FolderKanban,
  ImagePlus,
  LayoutGrid,
  Layers,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ResolvedImage } from './ResolvedMedia';
import { CategoryManagerModal } from './CategoryManagerModal';
import { CoffeeOptionsModal } from './CoffeeOptionsModal';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';
import {
  OperationType,
  db,
  deleteMediaFile,
  handleFirestoreError,
  uploadMediaFile,
} from '../lib/firebase';
import { PALM_METRIC_MENU, syncPalmMetricMenu } from '../lib/defaultMenu';
import { resolveItemModifiers } from '../lib/modifiers';
import {
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_MENU_CATEGORIES,
  MenuCategory,
  MenuItem,
  VALIDATION_LIMITS,
  formatPrice,
} from '../types';

interface MenuManagerViewProps {
  menuItems: MenuItem[];
  categories: CategoryItem[];
  coffeeOptions: CoffeeOptionsSettings;
  rulesUpdateRequired?: boolean;
  loading: boolean;
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

type ModifierMode = 'auto' | 'enabled' | 'disabled';

interface MenuFormState {
  name: string;
  nameAr: string;
  category: MenuCategory;
  price: string;
  description: string;
  descriptionAr: string;
  inStock: boolean;
  imageUrl: string;
  storagePath: string;
  milkMode: ModifierMode;
  coconutMilkPrice: string;
  tempMode: ModifierMode;
}

const INITIAL_FORM: MenuFormState = {
  name: '',
  nameAr: '',
  category: 'V60',
  price: '',
  description: '',
  descriptionAr: '',
  inStock: true,
  imageUrl: '',
  storagePath: '',
  milkMode: 'auto',
  coconutMilkPrice: '',
  tempMode: 'auto',
};

function boolToMode(val: boolean | undefined): ModifierMode {
  if (val === true) return 'enabled';
  if (val === false) return 'disabled';
  return 'auto';
}

export function MenuManagerView({
  menuItems,
  categories,
  coffeeOptions,
  rulesUpdateRequired = false,
  loading,
  createModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}: MenuManagerViewProps) {
  const { lang, t, categoryLabel, localizedItemName, localizedItemDescription } =
    useLanguage();
  const [categoryFilter, setCategoryFilter] = useState<'All' | MenuCategory>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByCategory, setGroupByCategory] = useState(true);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryTarget, setEditingCategoryTarget] = useState<CategoryItem | null>(
    null
  );
  const [coffeeOptionsModalOpen, setCoffeeOptionsModalOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const [form, setForm] = useState<MenuFormState>(INITIAL_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuFormNeedsRules, setMenuFormNeedsRules] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [syncingDefaults, setSyncingDefaults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isModalOpen = createModalOpen || localCreateOpen || editingItem !== null;

  const orderedCategoryKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    const sorted = [...categories].sort((a, b) =>
      a.sortOrder !== b.sortOrder
        ? a.sortOrder - b.sortOrder
        : a.nameEn.localeCompare(b.nameEn)
    );
    for (const c of sorted) {
      if (!seen.has(c.key)) {
        seen.add(c.key);
        keys.push(c.key);
      }
    }
    if (keys.length === 0) {
      for (const fallbackKey of DEFAULT_MENU_CATEGORIES) {
        if (!seen.has(fallbackKey)) {
          seen.add(fallbackKey);
          keys.push(fallbackKey);
        }
      }
    }
    for (const item of menuItems) {
      if (item.category && !seen.has(item.category)) {
        seen.add(item.category);
        keys.push(item.category);
      }
    }
    return keys;
  }, [categories, menuItems]);

  const missingStandardCount = useMemo(() => {
    const existingIds = new Set(menuItems.map((i) => i.id));
    return PALM_METRIC_MENU.filter((item) => !existingIds.has(item.id)).length;
  }, [menuItems]);

  const handleRestoreStandardMenu = async () => {
    setSyncingDefaults(true);
    try {
      const existingIds = new Set(menuItems.map((i) => i.id));
      await syncPalmMetricMenu(existingIds);
      localStorage.setItem('palm_metric_menu_synced_palm_metric_app_v1', 'true');
    } finally {
      setSyncingDefaults(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems
      .filter((item) => {
        if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
        if (stockFilter === 'inStock' && !item.inStock) return false;
        if (stockFilter === 'outOfStock' && item.inStock) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          localizedItemName(item).toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          localizedItemDescription(item).toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          categoryLabel(item.category).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const catA = orderedCategoryKeys.indexOf(a.category);
        const catB = orderedCategoryKeys.indexOf(b.category);
        const orderA = catA === -1 ? 999 : catA;
        const orderB = catB === -1 ? 999 : catB;
        if (orderA !== orderB) return orderA - orderB;
        return localizedItemName(a).localeCompare(localizedItemName(b));
      });
  }, [
    menuItems,
    categoryFilter,
    stockFilter,
    searchQuery,
    orderedCategoryKeys,
    localizedItemName,
    localizedItemDescription,
    categoryLabel,
  ]);

  React.useEffect(() => {
    if (createModalOpen && editingItem === null && !localCreateOpen) {
      setForm({
        ...INITIAL_FORM,
        category:
          categoryFilter !== 'All'
            ? categoryFilter
            : orderedCategoryKeys[0] || 'V60',
      });
      setSelectedFile(null);
      setPreviewUrl('');
      setUploadProgress(null);
      setFormError(null);
      setMenuFormNeedsRules(false);
    }
  }, [createModalOpen, editingItem, localCreateOpen, categoryFilter, orderedCategoryKeys]);

  const openCreateModalForCategory = (catKey: string) => {
    setEditingItem(null);
    setForm({
      ...INITIAL_FORM,
      category: catKey,
    });
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadProgress(null);
    setFormError(null);
    setMenuFormNeedsRules(false);
    setLocalCreateOpen(true);
  };

  const openDuplicateModal = (item: MenuItem) => {
    setEditingItem(null);
    setForm({
      name: `${item.name} (Copy)`,
      nameAr: item.nameAr ? `${item.nameAr} (نسخة)` : '',
      category: item.category,
      price: String(item.price),
      description: item.description,
      descriptionAr: item.descriptionAr || '',
      inStock: item.inStock,
      imageUrl: item.imageUrl,
      storagePath: '',
      milkMode: boolToMode(item.allowMilkOption),
      coconutMilkPrice:
        typeof item.coconutMilkPrice === 'number' ? String(item.coconutMilkPrice) : '',
      tempMode: boolToMode(item.allowTemperature),
    });
    setSelectedFile(null);
    setPreviewUrl(item.imageUrl);
    setUploadProgress(null);
    setFormError(null);
    setMenuFormNeedsRules(false);
    setLocalCreateOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setLocalCreateOpen(false);
    setEditingItem(item);
    setForm({
      name: item.name,
      nameAr: item.nameAr || '',
      category: item.category,
      price: String(item.price),
      description: item.description,
      descriptionAr: item.descriptionAr || '',
      inStock: item.inStock,
      imageUrl: item.imageUrl,
      storagePath: item.storagePath,
      milkMode: boolToMode(item.allowMilkOption),
      coconutMilkPrice:
        typeof item.coconutMilkPrice === 'number' ? String(item.coconutMilkPrice) : '',
      tempMode: boolToMode(item.allowTemperature),
    });
    setSelectedFile(null);
    setPreviewUrl(item.imageUrl);
    setUploadProgress(null);
    setFormError(null);
    setMenuFormNeedsRules(false);
  };

  const resetAndCloseModal = () => {
    setEditingItem(null);
    setLocalCreateOpen(false);
    setForm({
      ...INITIAL_FORM,
      category:
        categoryFilter !== 'All' ? categoryFilter : orderedCategoryKeys[0] || 'V60',
    });
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadProgress(null);
    setFormError(null);
    setMenuFormNeedsRules(false);
    onCloseCreateModal();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError(
        lang === 'ar'
          ? 'يرجى اختيار ملف صورة صالح (JPG أو PNG أو WebP).'
          : 'Please select a valid image file (JPG, PNG, or WebP).'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError(
        lang === 'ar'
          ? 'يجب أن يكون حجم الصورة أقل من 10 ميجابايت.'
          : 'Image file size must be under 10 MB.'
      );
      return;
    }
    setFormError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = form.name.trim();
    const trimmedNameAr = form.nameAr.trim();
    const trimmedDesc = form.description.trim();
    const trimmedDescAr = form.descriptionAr.trim();
    const trimmedCat = form.category.trim();
    const numericPrice = Number(form.price);
    const hasCustomCoconut = form.coconutMilkPrice.trim() !== '';
    const numericCoconutPrice = hasCustomCoconut ? Number(form.coconutMilkPrice) : undefined;

    if (!trimmedName || trimmedName.length > VALIDATION_LIMITS.menuItem.nameMaxLength) {
      setFormError(
        lang === 'ar'
          ? `يجب أن يكون اسم الصنف بين 1 و ${VALIDATION_LIMITS.menuItem.nameMaxLength} حرفاً.`
          : `Item name must be 1–${VALIDATION_LIMITS.menuItem.nameMaxLength} characters.`
      );
      return;
    }
    if (trimmedNameAr.length > VALIDATION_LIMITS.menuItem.nameMaxLength) {
      setFormError(
        lang === 'ar'
          ? `لا يمكن أن يتجاوز الاسم العربي ${VALIDATION_LIMITS.menuItem.nameMaxLength} حرفاً.`
          : `Arabic item name cannot exceed ${VALIDATION_LIMITS.menuItem.nameMaxLength} characters.`
      );
      return;
    }
    if (!trimmedCat || trimmedCat.length > VALIDATION_LIMITS.menuItem.categoryMaxLength) {
      setFormError(
        lang === 'ar' ? 'يرجى اختيار فئة صالحة.' : 'Please choose a valid category.'
      );
      return;
    }
    if (
      Number.isNaN(numericPrice) ||
      numericPrice < 0 ||
      numericPrice > VALIDATION_LIMITS.menuItem.priceMax
    ) {
      setFormError(
        lang === 'ar'
          ? `يجب أن يكون السعر بين 0 و ${VALIDATION_LIMITS.menuItem.priceMax} ﷼.`
          : `Price must be between 0 and ${VALIDATION_LIMITS.menuItem.priceMax} ﷼.`
      );
      return;
    }
    if (
      numericCoconutPrice !== undefined &&
      (Number.isNaN(numericCoconutPrice) ||
        numericCoconutPrice < 0 ||
        numericCoconutPrice > VALIDATION_LIMITS.menuItem.coconutMilkPriceMax)
    ) {
      setFormError(
        lang === 'ar'
          ? `يجب أن تكون رسوم حليب جوز الهند بين 0 و ${VALIDATION_LIMITS.menuItem.coconutMilkPriceMax} ﷼.`
          : `Coconut milk extra charge must be between 0 and ${VALIDATION_LIMITS.menuItem.coconutMilkPriceMax} ﷼.`
      );
      return;
    }
    if (trimmedDesc.length > VALIDATION_LIMITS.menuItem.descriptionMaxLength) {
      setFormError(
        lang === 'ar'
          ? `لا يمكن أن يتجاوز الوصف ${VALIDATION_LIMITS.menuItem.descriptionMaxLength} حرفاً.`
          : `Description cannot exceed ${VALIDATION_LIMITS.menuItem.descriptionMaxLength} characters.`
      );
      return;
    }

    setSaving(true);
    try {
      let imageUrl = form.imageUrl.trim();
      let storagePath = form.storagePath;
      const oldStoragePath = editingItem?.storagePath;

      if (imageUrl.length > VALIDATION_LIMITS.menuItem.imageUrlMaxLength) {
        setFormError(
          lang === 'ar'
            ? `يجب ألا يتجاوز رابط الصورة ${VALIDATION_LIMITS.menuItem.imageUrlMaxLength} حرفاً.`
            : `Image URL cannot exceed ${VALIDATION_LIMITS.menuItem.imageUrlMaxLength} characters.`
        );
        setSaving(false);
        return;
      }

      if (selectedFile) {
        setUploadProgress(0);
        const uploaded = await uploadMediaFile(
          selectedFile,
          'menu-items',
          (pct) => {
            setUploadProgress(pct);
          },
          lang
        );
        imageUrl = uploaded.downloadUrl;
        storagePath = uploaded.storagePath;
      } else if (editingItem && imageUrl !== editingItem.imageUrl) {
        storagePath = '';
      }

      if (editingItem) {
        const path = `menu/${editingItem.id}`;
        const updatePayload: Record<string, unknown> = {
          name: trimmedName,
          category: trimmedCat,
          price: Number(numericPrice.toFixed(2)),
          description: trimmedDesc,
          inStock: form.inStock,
          imageUrl,
          storagePath,
          updatedAt: serverTimestamp(),
        };
        if (trimmedNameAr) {
          updatePayload.nameAr = trimmedNameAr;
        } else if (editingItem.nameAr !== undefined) {
          updatePayload.nameAr = deleteField();
        }
        if (trimmedDescAr) {
          updatePayload.descriptionAr = trimmedDescAr;
        } else if (editingItem.descriptionAr !== undefined) {
          updatePayload.descriptionAr = deleteField();
        }
        if (form.milkMode === 'auto') {
          if (editingItem.allowMilkOption !== undefined) {
            updatePayload.allowMilkOption = deleteField();
          }
        } else {
          updatePayload.allowMilkOption = form.milkMode === 'enabled';
        }
        if (numericCoconutPrice !== undefined) {
          updatePayload.coconutMilkPrice = Number(numericCoconutPrice.toFixed(2));
        } else if (editingItem.coconutMilkPrice !== undefined) {
          updatePayload.coconutMilkPrice = deleteField();
        }
        if (form.tempMode === 'auto') {
          if (editingItem.allowTemperature !== undefined) {
            updatePayload.allowTemperature = deleteField();
          }
        } else {
          updatePayload.allowTemperature = form.tempMode === 'enabled';
        }

        try {
          await updateDoc(doc(db, 'menu', editingItem.id), updatePayload);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'permission-denied') {
            throw err;
          }
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        if (selectedFile && oldStoragePath && oldStoragePath !== storagePath) {
          await deleteMediaFile(oldStoragePath);
        }
      } else {
        const path = 'menu';
        try {
          await addDoc(collection(db, 'menu'), {
            name: trimmedName,
            ...(trimmedNameAr ? { nameAr: trimmedNameAr } : {}),
            category: trimmedCat,
            price: Number(numericPrice.toFixed(2)),
            description: trimmedDesc,
            ...(trimmedDescAr ? { descriptionAr: trimmedDescAr } : {}),
            inStock: form.inStock,
            imageUrl,
            storagePath,
            ...(form.milkMode !== 'auto'
              ? { allowMilkOption: form.milkMode === 'enabled' }
              : {}),
            ...(numericCoconutPrice !== undefined
              ? { coconutMilkPrice: Number(numericCoconutPrice.toFixed(2)) }
              : {}),
            ...(form.tempMode !== 'auto'
              ? { allowTemperature: form.tempMode === 'enabled' }
              : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'permission-denied') {
            throw err;
          }
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

      setMenuFormNeedsRules(false);
      resetAndCloseModal();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : String(err);
      if (code === 'permission-denied' || msg.toLowerCase().includes('insufficient permissions')) {
        setMenuFormNeedsRules(true);
        setFormError(
          lang === 'ar'
            ? 'تعذر الحفظ لأن قواعد Firestore في مشروع palm-metric-app لم يتم تحديثها بعد لدعم الفئات الجديدة وخيارات الحليب والحرارة.'
            : 'Save blocked by current Firestore rules in palm-metric-app. Publish the updated rules below to enable custom categories and milk/hot-cold modifiers.'
        );
      } else {
        setFormError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'تعذر حفظ الصنف.'
            : 'Unable to save menu item.'
        );
      }
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    setTogglingId(item.id);
    const path = `menu/${item.id}`;
    try {
      await updateDoc(doc(db, 'menu', item.id), {
        inStock: !item.inStock,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteItem) return;
    setDeleting(true);
    const target = confirmDeleteItem;
    const path = `menu/${target.id}`;
    try {
      await deleteDoc(doc(db, 'menu', target.id));
      await deleteMediaFile(target.storagePath);
      setConfirmDeleteItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setDeleting(false);
    }
  };

  const selectOptions = useMemo(() => {
    const list = [...orderedCategoryKeys];
    if (form.category && !list.includes(form.category)) {
      list.push(form.category);
    }
    return list;
  }, [orderedCategoryKeys, form.category]);

  const categoryByKey = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    for (const cat of categories) {
      map.set(cat.key, cat);
    }
    return map;
  }, [categories]);

  const openEditCategoryForKey = (catKey: string) => {
    const matched = categoryByKey.get(catKey) || null;
    setEditingCategoryTarget(matched);
    setCategoryModalOpen(true);
  };

  const selectedCategoryObj =
    categoryFilter !== 'All' ? categoryByKey.get(categoryFilter) || null : null;

  const shouldRenderGrouped =
    categoryFilter === 'All' && groupByCategory && searchQuery.trim() === '';

  const renderMenuCard = (item: MenuItem) => {
    const imgBroken = failedImages[item.id] || !item.imageUrl;
    const displayName = localizedItemName(item);
    const displayDesc = localizedItemDescription(item);
    const resolvedMods = resolveItemModifiers(item, categories, coffeeOptions);
    return (
      <article
        key={item.id}
        className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden flex flex-col justify-between transition-colors hover:border-[#BFCAC2]"
      >
        <div>
          {/* 4:3 Media Frame */}
          <div className="aspect-[4/3] bg-[#E8EFEA] relative overflow-hidden border-b border-[#E1E5E0]">
            {!imgBroken ? (
              <ResolvedImage
                src={item.imageUrl}
                alt={displayName}
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                }
                className={`w-full h-full object-cover transition-opacity ${
                  item.inStock ? 'opacity-100' : 'opacity-60 grayscale'
                }`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#4A6B56] bg-gradient-to-br from-[#EDF2EE] to-[#DCE6DF]">
                <Coffee className="w-7 h-7 opacity-75" />
                <span className="text-xs font-medium">{categoryLabel(item.category)}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#162019] leading-snug">
                {displayName}
              </h3>
              <span className="font-mono text-base font-semibold text-[#2C4435] tabular-nums shrink-0">
                {formatPrice(item.price)}
              </span>
            </div>

            <div className="text-xs text-[#6B786F] flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{categoryLabel(item.category)}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  item.inStock ? 'text-[#2C4435] font-medium' : 'text-[#991B1B] font-medium'
                }
              >
                {item.inStock ? t.inStock : t.outOfStock}
              </span>
              {resolvedMods.milkEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {t.milkOptionLabel} (+{formatPrice(resolvedMods.coconutMilkPrice)})
                  </span>
                </>
              )}
              {resolvedMods.temperatureEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.tempHot}/{t.tempCold}
                  </span>
                </>
              )}
            </div>

            {displayDesc && (
              <p className="text-sm text-[#4A584F] leading-relaxed line-clamp-2 pt-0.5">
                {displayDesc}
              </p>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-4 py-3 border-t border-[#E1E5E0] bg-[#F9FAF8] flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={togglingId === item.id}
            onClick={() => handleToggleAvailability(item)}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#162019] cursor-pointer disabled:opacity-50"
            aria-pressed={item.inStock}
          >
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                item.inStock ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  item.inStock ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
            <span className="whitespace-nowrap">
              {item.inStock ? t.inStock : t.outOfStock}
            </span>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => openDuplicateModal(item)}
              title={t.duplicateItem}
              aria-label={t.duplicateItem}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#4A584F] hover:bg-[#E8EFEA] hover:text-[#223629] transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openEditModal(item)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#39463D] hover:bg-[#E8EFEA] hover:text-[#223629] transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.edit}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteItem(item)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.deleteWord}</span>
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      {rulesUpdateRequired && <FirestoreRulesNotice />}

      {/* Configuration Bar: Categories + Coffee & Milk Options */}
      <div className="bg-white border border-[#E1E5E0] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-[#4A584F] flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            {t.milkOptionLabel}:{' '}
            <strong className="text-[#162019]">
              {coffeeOptions.milkSelectionEnabled ? t.modeEnabled : t.modeDisabled}
            </strong>
          </span>
          <span className="text-[#C7CEC9]" aria-hidden="true">·</span>
          <span>
            {t.milkCoconut}:{' '}
            <strong className="font-mono tabular-nums text-[#2C4435]">
              +{formatPrice(coffeeOptions.coconutMilkExtraPrice)}
            </strong>
          </span>
          <span className="text-[#C7CEC9]" aria-hidden="true">·</span>
          <span>
            {t.tempHot} / {t.tempCold}:{' '}
            <strong className="text-[#162019]">
              {coffeeOptions.hotColdSelectionEnabled ? t.modeEnabled : t.modeDisabled}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-xl border border-[#E1E5E0] bg-[#F5F6F4]">
            <button
              type="button"
              onClick={() => setGroupByCategory(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                groupByCategory
                  ? 'bg-white text-[#162019] shadow-xs'
                  : 'text-[#6B786F] hover:text-[#162019]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.groupByCategory}</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupByCategory(false)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                !groupByCategory
                  ? 'bg-white text-[#162019] shadow-xs'
                  : 'text-[#6B786F] hover:text-[#162019]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t.flatGridView}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingCategoryTarget(null);
              setCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#162019] whitespace-nowrap transition-colors cursor-pointer"
          >
            <FolderKanban className="w-3.5 h-3.5 text-[#2C4435]" />
            <span>{t.manageCategories}</span>
          </button>
          <button
            type="button"
            onClick={() => setCoffeeOptionsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD4CD] bg-[#E8EFEA]/60 hover:bg-[#E8EFEA] text-xs font-medium text-[#223629] whitespace-nowrap transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#2C4435]" />
            <span>{t.coffeeOptionsBtn}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl overflow-x-auto max-w-full">
            {(['All', ...orderedCategoryKeys] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#E8EFEA] text-[#223629]'
                    : 'text-[#4A584F] hover:text-[#162019] hover:bg-[#F5F6F4]'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl">
            {(
              [
                { id: 'all', label: t.allStock },
                { id: 'inStock', label: t.inStock },
                { id: 'outOfStock', label: t.outOfStock },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStockFilter(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  stockFilter === opt.id
                    ? 'bg-[#2C4435] text-white'
                    : 'text-[#4A584F] hover:text-[#162019]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto">
          {missingStandardCount > 0 && !loading && (
            <button
              type="button"
              disabled={syncingDefaults}
              onClick={handleRestoreStandardMenu}
              className="px-3 py-2 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#2C4435] whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncingDefaults ? t.addingMenu : `${t.addPalmMetricMenu} (${missingStandardCount})`}
            </button>
          )}
          <div className="relative flex-1 xl:w-64">
            <Search className="w-4 h-4 text-[#6B786F] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchMenuPlaceholder}
              aria-label={t.searchMenuPlaceholder}
              className="w-full ps-9 pe-3 py-2 bg-white border border-[#E1E5E0] rounded-xl text-sm text-[#162019] placeholder:text-[#89948C] focus:outline-none focus:border-[#2C4435]"
            />
          </div>
        </div>
      </div>

      {/* Selected Category Header Bar when filtered */}
      {categoryFilter !== 'All' && (
        <div className="bg-white border border-[#E1E5E0] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold text-[#162019]">
              {categoryLabel(categoryFilter)}
            </h2>
            {selectedCategoryObj && selectedCategoryObj.nameEn !== selectedCategoryObj.nameAr && (
              <span dir="ltr" className="text-xs text-[#6B786F]">
                ({lang === 'ar' ? selectedCategoryObj.nameEn : selectedCategoryObj.nameAr})
              </span>
            )}
            <span className="text-xs text-[#6B786F] tabular-nums">
              · {filteredItems.length} {t.itemsCountWord}
            </span>
            {selectedCategoryObj && !selectedCategoryObj.isActive && (
              <span className="text-xs text-[#991B1B] font-medium">
                · {t.inactiveLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedCategoryObj && (
              <button
                type="button"
                onClick={() => openEditCategoryForKey(selectedCategoryObj.key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#2C4435] cursor-pointer transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.editCategory}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openCreateModalForCategory(categoryFilter)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addItemToCategory}</span>
            </button>
          </div>
        </div>
      )}

      {/* Menu Grid or Grouped Category Sections */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#E8EFEA]" />
              <div className="p-4 space-y-2.5">
                <div className="h-5 w-2/3 bg-[#E8EFEA] rounded" />
                <div className="h-4 w-full bg-[#F5F6F4] rounded" />
                <div className="h-8 w-full bg-[#F5F6F4] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : shouldRenderGrouped && orderedCategoryKeys.length > 0 ? (
        <div className="space-y-6">
          {orderedCategoryKeys.map((catKey) => {
            const catObj = categoryByKey.get(catKey) || null;
            const sectionItems = filteredItems.filter((item) => item.category === catKey);
            return (
              <section key={catKey} className="space-y-3">
                <div className="bg-white border border-[#E1E5E0] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-[#162019]">
                      {categoryLabel(catKey)}
                    </h2>
                    {catObj && catObj.nameEn !== catObj.nameAr && (
                      <span dir="ltr" className="text-xs text-[#6B786F]">
                        ({lang === 'ar' ? catObj.nameEn : catObj.nameAr})
                      </span>
                    )}
                    <span className="text-xs text-[#6B786F] tabular-nums">
                      · {sectionItems.length} {t.itemsCountWord}
                    </span>
                    {catObj && !catObj.isActive && (
                      <span className="text-xs text-[#991B1B] font-medium">
                        · {t.inactiveLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {catObj && (
                      <button
                        type="button"
                        onClick={() => openEditCategoryForKey(catKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-xs font-medium text-[#2C4435] cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t.editCategory}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openCreateModalForCategory(catKey)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.addItemToCategory}</span>
                    </button>
                  </div>
                </div>

                {sectionItems.length === 0 ? (
                  <div className="bg-white border border-dashed border-[#CBD4CD] rounded-xl p-6 text-center space-y-2">
                    <p className="text-xs text-[#6B786F]">
                      {lang === 'ar'
                        ? `لا توجد أصناف في "${categoryLabel(catKey)}" حتى الآن.`
                        : `No items in "${categoryLabel(catKey)}" yet.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sectionItems.map((item) => renderMenuCard(item))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-[#E1E5E0] rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-[#E8EFEA] text-[#2C4435] flex items-center justify-center mx-auto">
            <Coffee className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {menuItems.length === 0 ? t.emptyMenuTitle : t.noMatchingMenuTitle}
            </h3>
            <p className="text-sm text-[#6B786F]">
              {menuItems.length === 0 ? t.emptyMenuDesc : t.noMatchingMenuDesc}
            </p>
          </div>
          {categoryFilter !== 'All' ? (
            <button
              type="button"
              onClick={() => openCreateModalForCategory(categoryFilter)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addItemToCategory}</span>
            </button>
          ) : (
            menuItems.length === 0 && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addFirstMenuItem}</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => renderMenuCard(item))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? t.editMenuItem : t.addMenuItemTitle}
          className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#162019]">
                {editingItem ? t.editMenuItem : t.addMenuItemTitle}
              </h2>
              <button
                type="button"
                onClick={resetAndCloseModal}
                aria-label={t.cancel}
                className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] hover:text-[#162019] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuItem} className="p-6 space-y-4">
              {menuFormNeedsRules && <FirestoreRulesNotice compact />}

              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                  {formError}
                </div>
              )}

              {/* Image Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#39463D]">
                  {t.itemImageLabel}
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-20 rounded-xl border border-[#E1E5E0] bg-[#F5F6F4] overflow-hidden shrink-0 flex items-center justify-center">
                    {previewUrl ? (
                      <ResolvedImage
                        src={previewUrl}
                        alt={t.itemImageLabel}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Coffee className="w-6 h-6 text-[#89948C]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#CBD4CD] bg-[#F5F6F4] hover:bg-[#E8EFEA] text-xs font-medium text-[#162019] transition-colors cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-[#2C4435]" />
                      <span>{selectedFile ? t.replaceSelectedFile : t.uploadImageDevice}</span>
                    </button>
                    <p className="text-xs text-[#6B786F] truncate">
                      {selectedFile
                        ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`
                        : previewUrl
                        ? t.imageStoredHint
                        : t.imageFormatHint}
                    </p>
                  </div>
                </div>

                {uploadProgress !== null && (
                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between text-xs text-[#2C4435] tabular-nums">
                      <span>{t.uploadingStorage}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8EFEA] overflow-hidden">
                      <div
                        className="h-full bg-[#2C4435] transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-1 space-y-1">
                  <label htmlFor="menu-image-url" className="block text-xs font-medium text-[#39463D]">
                    {t.orImageUrlLabel}
                  </label>
                  <input
                    id="menu-image-url"
                    type="url"
                    dir="ltr"
                    maxLength={VALIDATION_LIMITS.menuItem.imageUrlMaxLength}
                    value={form.imageUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({ ...f, imageUrl: val }));
                      if (selectedFile) {
                        setSelectedFile(null);
                      }
                      setPreviewUrl(val.trim());
                    }}
                    placeholder={t.orImageUrlPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="menu-name" className="block text-xs font-medium text-[#39463D]">
                    {t.itemNameLabel}
                  </label>
                  <input
                    id="menu-name"
                    type="text"
                    dir="ltr"
                    required
                    maxLength={VALIDATION_LIMITS.menuItem.nameMaxLength}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t.itemNamePlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="menu-name-ar" className="block text-xs font-medium text-[#39463D]">
                    {t.itemNameArLabel}
                  </label>
                  <input
                    id="menu-name-ar"
                    type="text"
                    dir="rtl"
                    maxLength={VALIDATION_LIMITS.menuItem.nameMaxLength}
                    value={form.nameAr}
                    onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                    placeholder={t.itemNameArPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="menu-category" className="block text-xs font-medium text-[#39463D]">
                  {t.categoryLabel}
                </label>
                <select
                  id="menu-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as MenuCategory }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                >
                  {selectOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="space-y-1.5">
                  <label htmlFor="menu-price" className="block text-xs font-medium text-[#39463D]">
                    {t.priceLabel}
                  </label>
                  <input
                    id="menu-price"
                    type="number"
                    step="0.5"
                    min="0"
                    max={VALIDATION_LIMITS.menuItem.priceMax}
                    required
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="14"
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm font-mono tabular-nums text-[#162019] focus:outline-none focus:border-[#2C4435]"
                  />
                </div>

                <div className="pb-1.5">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, inStock: !f.inStock }))}
                    className="inline-flex items-center gap-3 text-sm font-medium text-[#162019] cursor-pointer"
                  >
                    <span
                      className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                        form.inStock ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          form.inStock ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                    <span>{form.inStock ? t.inStockVisible : t.outOfStock}</span>
                  </button>
                </div>
              </div>

              {/* Per-item Milk & Hot/Cold Modifiers */}
              <div className="p-4 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] space-y-3">
                <p className="text-xs font-semibold text-[#162019]">
                  {t.itemModifiersTitle}
                </p>

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[#39463D]">
                    {t.itemMilkSettingLabel}
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-[#E1E5E0]">
                    {(
                      [
                        { id: 'auto', label: t.modeAutoCategory },
                        { id: 'enabled', label: t.modeEnabled },
                        { id: 'disabled', label: t.modeDisabled },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, milkMode: opt.id }))}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          form.milkMode === opt.id
                            ? 'bg-[#2C4435] text-white'
                            : 'text-[#4A584F] hover:bg-[#F5F6F4]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.milkMode !== 'disabled' && (
                  <div className="space-y-1">
                    <label
                      htmlFor="item-coconut-price"
                      className="block text-xs font-medium text-[#39463D]"
                    >
                      {t.itemCoconutOverrideLabel}
                    </label>
                    <input
                      id="item-coconut-price"
                      type="number"
                      step="0.5"
                      min="0"
                      max={VALIDATION_LIMITS.menuItem.coconutMilkPriceMax}
                      value={form.coconutMilkPrice}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, coconutMilkPrice: e.target.value }))
                      }
                      placeholder={`${t.itemCoconutOverridePlaceholder} (${coffeeOptions.coconutMilkExtraPrice} ﷼)`}
                      className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-xs font-mono tabular-nums text-[#162019] focus:outline-none focus:border-[#2C4435]"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[#39463D]">
                    {t.itemTempSettingLabel}
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-[#E1E5E0]">
                    {(
                      [
                        { id: 'auto', label: t.modeAutoCategory },
                        { id: 'enabled', label: t.modeEnabled },
                        { id: 'disabled', label: t.modeDisabled },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, tempMode: opt.id }))}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          form.tempMode === opt.id
                            ? 'bg-[#2C4435] text-white'
                            : 'text-[#4A584F] hover:bg-[#F5F6F4]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="menu-desc" className="block text-xs font-medium text-[#39463D]">
                    {t.descriptionLabel}
                  </label>
                  <textarea
                    id="menu-desc"
                    rows={3}
                    dir="ltr"
                    maxLength={VALIDATION_LIMITS.menuItem.descriptionMaxLength}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t.descriptionPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="menu-desc-ar" className="block text-xs font-medium text-[#39463D]">
                    {t.descriptionArLabel}
                  </label>
                  <textarea
                    id="menu-desc-ar"
                    rows={3}
                    dir="rtl"
                    maxLength={VALIDATION_LIMITS.menuItem.descriptionMaxLength}
                    value={form.descriptionAr}
                    onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                    placeholder={t.descriptionArPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435] resize-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E1E5E0]">
                <button
                  type="button"
                  onClick={resetAndCloseModal}
                  className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  {saving
                    ? t.saving
                    : editingItem
                    ? t.saveChanges
                    : t.createMenuItem}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.deleteConfirmItemTitle}
          className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {lang === 'ar'
                ? `حذف "${localizedItemName(confirmDeleteItem)}"؟`
                : `Delete "${localizedItemName(confirmDeleteItem)}"?`}
            </h3>
            <p className="text-sm text-[#4A584F]">
              {t.deleteConfirmItemBody}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {deleting ? t.deleting : t.deleteItemAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category & Coffee Options Modals */}
      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategoryTarget(null);
        }}
        categories={categories}
        menuItems={menuItems}
        rulesUpdateRequired={rulesUpdateRequired}
        initialEditCategory={editingCategoryTarget}
        onAddItemToCategory={(catKey) => openCreateModalForCategory(catKey)}
        onCategoryRenamed={(oldKey, nextKey) => {
          if (categoryFilter === oldKey) {
            setCategoryFilter(nextKey);
          }
        }}
      />

      <CoffeeOptionsModal
        open={coffeeOptionsModalOpen}
        onClose={() => setCoffeeOptionsModalOpen(false)}
        coffeeOptions={coffeeOptions}
        rulesUpdateRequired={rulesUpdateRequired}
      />
    </div>
  );
}
