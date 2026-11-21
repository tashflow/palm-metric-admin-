import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';
import {
  OperationType,
  db,
  deleteMediaFile,
  handleFirestoreError,
} from '../lib/firebase';
import { CategoryItem, MenuItem, VALIDATION_LIMITS } from '../types';

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  menuItems: MenuItem[];
  rulesUpdateRequired?: boolean;
  initialEditCategory?: CategoryItem | null;
  onAddItemToCategory?: (categoryKey: string) => void;
  onCategoryRenamed?: (oldKey: string, newKey: string) => void;
}

interface CategoryFormState {
  nameEn: string;
  nameAr: string;
  sortOrder: string;
  isActive: boolean;
  allowMilkOption: boolean;
  allowTemperature: boolean;
}

function buildCategoryId(nameEn: string): string {
  const slug = nameEn
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `cat-${slug || 'custom'}-${suffix}`;
}

export function CategoryManagerModal({
  open,
  onClose,
  categories,
  menuItems,
  rulesUpdateRequired = false,
  initialEditCategory = null,
  onAddItemToCategory,
  onCategoryRenamed,
}: CategoryManagerModalProps) {
  const { lang, t } = useLanguage();
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState<CategoryFormState>({
    nameEn: '',
    nameAr: '',
    sortOrder: String(categories.length),
    isActive: true,
    allowMilkOption: true,
    allowTemperature: true,
  });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [reassignTargetKey, setReassignTargetKey] = useState<string>('');
  const [needsRulesPublish, setNeedsRulesPublish] = useState(rulesUpdateRequired);
  const [error, setError] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : a.nameEn.localeCompare(b.nameEn)
      ),
    [categories]
  );

  const itemCountsByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of menuItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [menuItems]);

  useEffect(() => {
    if (!open) return;
    setNeedsRulesPublish(rulesUpdateRequired);
    setError(null);
    setDeleteTarget(null);
    if (initialEditCategory) {
      setEditingCat(initialEditCategory);
      setForm({
        nameEn: initialEditCategory.nameEn,
        nameAr: initialEditCategory.nameAr,
        sortOrder: String(initialEditCategory.sortOrder),
        isActive: initialEditCategory.isActive,
        allowMilkOption: initialEditCategory.allowMilkOption,
        allowTemperature: initialEditCategory.allowTemperature,
      });
    } else {
      setEditingCat(null);
      setForm({
        nameEn: '',
        nameAr: '',
        sortOrder: String(categories.length),
        isActive: true,
        allowMilkOption: true,
        allowTemperature: true,
      });
    }
  }, [open, initialEditCategory, rulesUpdateRequired, categories.length]);

  if (!open) return null;

  const resetForm = () => {
    setEditingCat(null);
    setForm({
      nameEn: '',
      nameAr: '',
      sortOrder: String(categories.length),
      isActive: true,
      allowMilkOption: true,
      allowTemperature: true,
    });
    setDeleteTarget(null);
    setError(null);
  };

  const startEdit = (cat: CategoryItem) => {
    setEditingCat(cat);
    setDeleteTarget(null);
    setForm({
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
      allowMilkOption: cat.allowMilkOption,
      allowTemperature: cat.allowTemperature,
    });
    setError(null);
  };

  const handlePermissionOrError = (err: unknown, op: OperationType, path: string) => {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'permission-denied' || msg.toLowerCase().includes('insufficient permissions')) {
      setNeedsRulesPublish(true);
      setError(
        lang === 'ar'
          ? 'تعذر الحفظ لأن قواعد Firestore في مشروع palm-metric-app لم يتم تحديثها بعد. انسخ القواعد أدناه وانشرها في Firebase Console ثم أعد المحاولة.'
          : 'Action blocked by current Firestore rules in palm-metric-app. Copy and publish the updated rules below in Firebase Console, then try again.'
      );
      return;
    }
    setError(
      err instanceof Error
        ? err.message
        : lang === 'ar'
        ? 'تعذر إتمام العملية.'
        : 'Unable to complete operation.'
    );
    handleFirestoreError(err, op, path);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameEn = form.nameEn.trim();
    const nameAr = (form.nameAr.trim() || nameEn).trim();
    const sortOrder = Math.max(
      0,
      Math.min(
        VALIDATION_LIMITS.category.sortOrderMax,
        Math.round(Number(form.sortOrder) || 0)
      )
    );

    if (!nameEn || nameEn.length > VALIDATION_LIMITS.category.nameMaxLength) {
      setError(
        lang === 'ar'
          ? `اسم الفئة بالإنجليزية مطلوب (حتى ${VALIDATION_LIMITS.category.nameMaxLength} حرفاً).`
          : `English category name is required (1–${VALIDATION_LIMITS.category.nameMaxLength} characters).`
      );
      return;
    }

    if (nameAr.length > VALIDATION_LIMITS.category.nameMaxLength) {
      setError(
        lang === 'ar'
          ? `اسم الفئة بالعربية يجب ألا يتجاوز ${VALIDATION_LIMITS.category.nameMaxLength} حرفاً.`
          : `Arabic category name cannot exceed ${VALIDATION_LIMITS.category.nameMaxLength} characters.`
      );
      return;
    }

    const duplicate = categories.find(
      (c) =>
        c.id !== editingCat?.id &&
        (c.key.toLowerCase() === nameEn.toLowerCase() ||
          c.nameEn.toLowerCase() === nameEn.toLowerCase())
    );
    if (duplicate) {
      setError(
        lang === 'ar'
          ? 'توجد فئة بهذا الاسم بالفعل.'
          : 'A category with this English name already exists.'
      );
      return;
    }

    setSaving(true);
    try {
      if (editingCat) {
        const oldKey = editingCat.key;
        const oldNameEn = editingCat.nameEn;
        const nextKey = nameEn;
        const path = `categories/${editingCat.id}`;
        const catRef = doc(db, 'categories', editingCat.id);

        try {
          const existingSnap = await getDoc(catRef);
          if (existingSnap.exists()) {
            await updateDoc(catRef, {
              key: nextKey,
              nameEn,
              nameAr,
              sortOrder,
              isActive: form.isActive,
              allowMilkOption: form.allowMilkOption,
              allowTemperature: form.allowTemperature,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(catRef, {
              key: nextKey,
              nameEn,
              nameAr,
              sortOrder,
              isActive: form.isActive,
              allowMilkOption: form.allowMilkOption,
              allowTemperature: form.allowTemperature,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'permission-denied') throw err;
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        if (oldKey !== nextKey) {
          const affectedItems = menuItems.filter(
            (item) => item.category === oldKey || item.category === oldNameEn
          );
          if (affectedItems.length > 0) {
            const batch = writeBatch(db);
            for (const item of affectedItems) {
              batch.update(doc(db, 'menu', item.id), {
                category: nextKey,
                updatedAt: serverTimestamp(),
              });
            }
            try {
              await batch.commit();
            } catch (err) {
              const code = (err as { code?: string })?.code;
              if (code === 'permission-denied') throw err;
              handleFirestoreError(err, OperationType.WRITE, 'menu');
            }
          }
          onCategoryRenamed?.(oldKey, nextKey);
        }
      } else {
        const id = buildCategoryId(nameEn);
        const path = `categories/${id}`;
        try {
          await setDoc(doc(collection(db, 'categories'), id), {
            key: nameEn,
            nameEn,
            nameAr,
            sortOrder,
            isActive: form.isActive,
            allowMilkOption: form.allowMilkOption,
            allowTemperature: form.allowTemperature,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'permission-denied') throw err;
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      setNeedsRulesPublish(false);
      resetForm();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : String(err);
      if (code === 'permission-denied' || msg.toLowerCase().includes('insufficient permissions')) {
        setNeedsRulesPublish(true);
        setError(
          lang === 'ar'
            ? 'تعذر الحفظ لأن قواعد Firestore في مشروع palm-metric-app لم يتم تحديثها بعد. انسخ القواعد أدناه وانشرها في Firebase Console ثم أعد المحاولة.'
            : 'Save blocked by current Firestore rules in palm-metric-app. Copy and publish the updated rules below in Firebase Console, then try again.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'تعذر حفظ الفئة.'
            : 'Unable to save category.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: CategoryItem) => {
    setError(null);
    setBusyId(cat.id);
    const path = `categories/${cat.id}`;
    const catRef = doc(db, 'categories', cat.id);
    try {
      const snap = await getDoc(catRef);
      if (snap.exists()) {
        await updateDoc(catRef, {
          isActive: !cat.isActive,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(catRef, {
          key: cat.key,
          nameEn: cat.nameEn,
          nameAr: cat.nameAr,
          sortOrder: cat.sortOrder,
          isActive: !cat.isActive,
          allowMilkOption: cat.allowMilkOption,
          allowTemperature: cat.allowTemperature,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handlePermissionOrError(err, OperationType.UPDATE, path);
    } finally {
      setBusyId(null);
    }
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sortedCategories.length) return;

    const current = sortedCategories[index];
    const target = sortedCategories[swapIndex];
    const currentOrder = index;
    const targetOrder = swapIndex;

    setError(null);
    setBusyId(current.id);
    try {
      const batch = writeBatch(db);
      const [curSnap, tgtSnap] = await Promise.all([
        getDoc(doc(db, 'categories', current.id)),
        getDoc(doc(db, 'categories', target.id)),
      ]);

      if (curSnap.exists()) {
        batch.update(doc(db, 'categories', current.id), {
          sortOrder: targetOrder,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'categories', current.id), {
          key: current.key,
          nameEn: current.nameEn,
          nameAr: current.nameAr,
          sortOrder: targetOrder,
          isActive: current.isActive,
          allowMilkOption: current.allowMilkOption,
          allowTemperature: current.allowTemperature,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (tgtSnap.exists()) {
        batch.update(doc(db, 'categories', target.id), {
          sortOrder: currentOrder,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'categories', target.id), {
          key: target.key,
          nameEn: target.nameEn,
          nameAr: target.nameAr,
          sortOrder: currentOrder,
          isActive: target.isActive,
          allowMilkOption: target.allowMilkOption,
          allowTemperature: target.allowTemperature,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      handlePermissionOrError(err, OperationType.WRITE, 'categories');
    } finally {
      setBusyId(null);
    }
  };

  const initiateDelete = (cat: CategoryItem) => {
    const count = itemCountsByKey[cat.key] || 0;
    if (count === 0) {
      void executeEmptyDelete(cat);
      return;
    }
    const alternatives = sortedCategories.filter((c) => c.id !== cat.id);
    setDeleteTarget(cat);
    setReassignTargetKey(alternatives[0]?.key || '');
    setError(null);
  };

  const executeEmptyDelete = async (cat: CategoryItem) => {
    setError(null);
    setBusyId(cat.id);
    const path = `categories/${cat.id}`;
    try {
      await deleteDoc(doc(db, 'categories', cat.id));
      if (editingCat?.id === cat.id) {
        resetForm();
      }
    } catch (err) {
      handlePermissionOrError(err, OperationType.DELETE, path);
    } finally {
      setBusyId(null);
    }
  };

  const executeReassignAndDelete = async (cat: CategoryItem) => {
    if (!reassignTargetKey) return;
    setError(null);
    setBusyId(cat.id);
    try {
      const affected = menuItems.filter(
        (item) => item.category === cat.key || item.category === cat.nameEn
      );
      const batch = writeBatch(db);
      for (const item of affected) {
        batch.update(doc(db, 'menu', item.id), {
          category: reassignTargetKey,
          updatedAt: serverTimestamp(),
        });
      }
      batch.delete(doc(db, 'categories', cat.id));
      await batch.commit();
      setDeleteTarget(null);
      if (editingCat?.id === cat.id) {
        resetForm();
      }
    } catch (err) {
      handlePermissionOrError(err, OperationType.WRITE, `categories/${cat.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const executeDeleteCategoryAndItems = async (cat: CategoryItem) => {
    setError(null);
    setBusyId(cat.id);
    try {
      const affected = menuItems.filter(
        (item) => item.category === cat.key || item.category === cat.nameEn
      );
      const batch = writeBatch(db);
      for (const item of affected) {
        batch.delete(doc(db, 'menu', item.id));
      }
      batch.delete(doc(db, 'categories', cat.id));
      await batch.commit();

      await Promise.all(
        affected
          .filter((item) => item.storagePath)
          .map((item) => deleteMediaFile(item.storagePath))
      );

      setDeleteTarget(null);
      if (editingCat?.id === cat.id) {
        resetForm();
      }
    } catch (err) {
      handlePermissionOrError(err, OperationType.WRITE, `categories/${cat.id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.manageCategories}
      className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between gap-4 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#162019]">
              {t.manageCategories}
            </h2>
            <p className="text-xs text-[#6B786F] mt-0.5">{t.manageCategoriesDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            aria-label={t.dismiss}
            className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] hover:text-[#162019] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {(needsRulesPublish || rulesUpdateRequired) && <FirestoreRulesNotice />}

          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          {/* Add / Edit Category Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-xl border border-[#E1E5E0] bg-[#F9FAF8] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#162019]">
                {editingCat
                  ? `${t.editCategory}: ${lang === 'ar' ? editingCat.nameAr : editingCat.nameEn}`
                  : t.addNewCategory}
              </h3>
              {editingCat && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-[#2C4435] hover:underline cursor-pointer"
                >
                  {t.cancel}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="cat-name-en"
                  className="block text-xs font-medium text-[#39463D]"
                >
                  {t.categoryNameEnLabel}
                </label>
                <input
                  id="cat-name-en"
                  type="text"
                  dir="ltr"
                  required
                  maxLength={VALIDATION_LIMITS.category.nameMaxLength}
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  placeholder={t.categoryNameEnPlaceholder}
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="cat-name-ar"
                  className="block text-xs font-medium text-[#39463D]"
                >
                  {t.categoryNameArLabel}
                </label>
                <input
                  id="cat-name-ar"
                  type="text"
                  dir="rtl"
                  maxLength={VALIDATION_LIMITS.category.nameMaxLength}
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder={t.categoryNameArPlaceholder}
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="cat-sort-order"
                  className="block text-xs font-medium text-[#39463D]"
                >
                  {t.categorySortOrderLabel}
                </label>
                <input
                  id="cat-sort-order"
                  type="number"
                  min={0}
                  max={VALIDATION_LIMITS.category.sortOrderMax}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm font-mono tabular-nums text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-[#162019] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#2C4435] rounded cursor-pointer"
                />
                <span>{t.categoryActiveLabel}</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[#162019] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowMilkOption}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allowMilkOption: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#2C4435] rounded cursor-pointer"
                />
                <span>{t.categoryDefaultMilkLabel}</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[#162019] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowTemperature}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allowTemperature: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#2C4435] rounded cursor-pointer"
                />
                <span>{t.categoryDefaultTempLabel}</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium cursor-pointer transition-colors"
              >
                {!editingCat && <Plus className="w-3.5 h-3.5" />}
                <span>
                  {saving
                    ? t.saving
                    : editingCat
                    ? t.updateCategoryBtn
                    : t.createCategoryBtn}
                </span>
              </button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div className="border border-[#E1E5E0] rounded-xl divide-y divide-[#E1E5E0] bg-white">
            {sortedCategories.map((cat, idx) => {
              const count = itemCountsByKey[cat.key] || 0;
              const isEditingThis = editingCat?.id === cat.id;
              const isDeleteOpen = deleteTarget?.id === cat.id;
              const alternatives = sortedCategories.filter((c) => c.id !== cat.id);
              const isBusy = busyId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`px-4 py-3 space-y-3 ${
                    isEditingThis ? 'bg-[#E8EFEA]/50' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[#6B786F] tabular-nums">
                          #{cat.sortOrder}
                        </span>
                        <span className="text-sm font-semibold text-[#162019]">
                          {cat.nameAr}
                        </span>
                        <span className="text-[#C7CEC9]" aria-hidden="true">
                          ·
                        </span>
                        <span dir="ltr" className="text-sm text-[#39463D]">
                          {cat.nameEn}
                        </span>
                        {!cat.isActive && (
                          <>
                            <span className="text-[#C7CEC9]" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs text-[#991B1B] font-medium">
                              {t.inactiveLabel}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B786F]">
                        <span className="tabular-nums">
                          {count} {t.itemsCountWord}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.milkOptionLabel}:{' '}
                          {cat.allowMilkOption ? t.modeEnabled : t.modeDisabled}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.tempHot}/{t.tempCold}:{' '}
                          {cat.allowTemperature ? t.modeEnabled : t.modeDisabled}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy || idx === 0}
                        onClick={() => handleMoveOrder(idx, -1)}
                        aria-label={t.moveUp}
                        title={t.moveUp}
                        className="p-1.5 rounded-lg text-[#4A584F] hover:bg-[#F5F6F4] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || idx === sortedCategories.length - 1}
                        onClick={() => handleMoveOrder(idx, 1)}
                        aria-label={t.moveDown}
                        title={t.moveDown}
                        className="p-1.5 rounded-lg text-[#4A584F] hover:bg-[#F5F6F4] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleActive(cat)}
                        aria-pressed={cat.isActive}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          cat.isActive
                            ? 'bg-[#E8EFEA] border-[#B6C7BC] text-[#223629]'
                            : 'bg-[#F5F6F4] border-[#E1E5E0] text-[#6B786F]'
                        }`}
                      >
                        {cat.isActive ? t.activeCountLabel : t.inactiveCountLabel}
                      </button>

                      {onAddItemToCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onAddItemToCategory(cat.key);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#2C4435] hover:bg-[#223629] text-white transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.addMenuItem}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2C4435] hover:bg-[#E8EFEA] transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{t.edit}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => initiateDelete(cat)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.deleteWord}</span>
                      </button>
                    </div>
                  </div>

                  {isDeleteOpen && (
                    <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-3 text-xs text-[#991B1B]">
                      <p className="font-medium">
                        {t.deleteCategoryWarningPrefix} {count} {t.itemsCountWord}.
                      </p>

                      {alternatives.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <label htmlFor={`reassign-${cat.id}`} className="shrink-0">
                            {t.moveItemsToLabel}
                          </label>
                          <select
                            id={`reassign-${cat.id}`}
                            value={reassignTargetKey}
                            onChange={(e) => setReassignTargetKey(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#FCA5A5] bg-white text-[#162019] text-xs"
                          >
                            {alternatives.map((alt) => (
                              <option key={alt.id} value={alt.key}>
                                {lang === 'ar' ? alt.nameAr : alt.nameEn}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isBusy || !reassignTargetKey}
                            onClick={() => executeReassignAndDelete(cat)}
                            className="px-3 py-1.5 rounded-lg bg-[#2C4435] hover:bg-[#223629] text-white font-medium cursor-pointer"
                          >
                            {t.reassignAndDeleteBtn}
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(null)}
                          className="px-3 py-1.5 rounded-lg border border-[#FECACA] bg-white text-[#4A584F] font-medium cursor-pointer"
                        >
                          {t.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => executeDeleteCategoryAndItems(cat)}
                          className="px-3 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white font-medium cursor-pointer"
                        >
                          {t.deleteCategoryAndItemsBtn}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
