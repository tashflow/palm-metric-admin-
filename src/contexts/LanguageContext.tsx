import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CATEGORY_LABELS,
  Language,
  MENU_ITEM_AR_TRANSLATIONS,
  ORDER_STATUS_LABELS,
  TRANSLATIONS,
} from '../i18n/translations';
import { DEFAULT_CATEGORIES, PALM_METRIC_MENU } from '../lib/defaultMenu';
import { CategoryItem, MenuCategory, MenuItem, OrderStatus } from '../types';

const STORAGE_KEY = 'palm_metric_lang';

const SEED_ITEM_BY_ID = new Map(PALM_METRIC_MENU.map((item) => [item.id, item]));

interface LanguageContextValue {
  lang: Language;
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (typeof TRANSLATIONS)[Language];
  setDynamicCategories: (categories: CategoryItem[]) => void;
  categoryLabel: (cat: MenuCategory | 'All') => string;
  statusLabel: (status: OrderStatus) => string;
  localizedItemName: (item: Pick<MenuItem, 'id' | 'name' | 'nameAr'>) => string;
  localizedItemDescription: (
    item: Pick<MenuItem, 'id' | 'description' | 'descriptionAr'>
  ) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'ar';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const [dynamicCategories, setDynamicCategories] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true }))
  );

  useEffect(() => {
    const isArabic = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage access errors
    }
  }, [lang]);

  const setLang = (next: Language) => setLangState(next);
  const toggleLang = () => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));

  const categoryLabel = useCallback(
    (cat: MenuCategory | 'All') => {
      if (cat === 'All') return CATEGORY_LABELS[lang].All || 'All';
      const matched = dynamicCategories.find(
        (c) => c.key === cat || c.nameEn === cat || c.nameAr === cat
      );
      if (matched) {
        return lang === 'ar'
          ? matched.nameAr || matched.nameEn
          : matched.nameEn || matched.nameAr;
      }
      return CATEGORY_LABELS[lang][cat] || cat;
    },
    [dynamicCategories, lang]
  );

  const statusLabel = (status: OrderStatus) =>
    ORDER_STATUS_LABELS[lang][status] || status;

  const localizedItemName = useCallback(
    (item: Pick<MenuItem, 'id' | 'name' | 'nameAr'>) => {
      if (lang === 'ar') {
        if (item.nameAr && item.nameAr.trim()) return item.nameAr.trim();
        const seed = SEED_ITEM_BY_ID.get(item.id);
        if (seed && seed.name === item.name && MENU_ITEM_AR_TRANSLATIONS[item.id]) {
          return MENU_ITEM_AR_TRANSLATIONS[item.id].name;
        }
      }
      return item.name;
    },
    [lang]
  );

  const localizedItemDescription = useCallback(
    (item: Pick<MenuItem, 'id' | 'description' | 'descriptionAr'>) => {
      if (lang === 'ar') {
        if (item.descriptionAr && item.descriptionAr.trim()) {
          return item.descriptionAr.trim();
        }
        const seed = SEED_ITEM_BY_ID.get(item.id);
        if (
          seed &&
          seed.description === item.description &&
          MENU_ITEM_AR_TRANSLATIONS[item.id]
        ) {
          return MENU_ITEM_AR_TRANSLATIONS[item.id].description;
        }
      }
      return item.description;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        isRtl: lang === 'ar',
        setLang,
        toggleLang,
        t: TRANSLATIONS[lang],
        setDynamicCategories,
        categoryLabel,
        statusLabel,
        localizedItemName,
        localizedItemDescription,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
