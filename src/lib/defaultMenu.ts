import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from './firebase';
import { MenuCategory } from '../types';

export interface DefaultMenuSeedItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
}

export const PALM_METRIC_MENU: DefaultMenuSeedItem[] = [
  // V60
  {
    id: 'v60-ethiopia-hot-cold',
    name: 'Ethiopia Hot / Cold',
    category: 'V60',
    price: 12,
    description: 'Hand-poured single-origin Ethiopian filter coffee served hot or over ice.',
  },
  {
    id: 'v60-colombia-hot-cold',
    name: 'Colombia Hot / Cold',
    category: 'V60',
    price: 12,
    description: 'Balanced Colombian single-origin pour-over served hot or chilled.',
  },
  {
    id: 'v60-yemen-hot-cold',
    name: 'Yemen Hot / Cold',
    category: 'V60',
    price: 15,
    description: 'Distinctive Yemeni heirloom pour-over with warm spice notes, hot or cold.',
  },

  // Espresso
  {
    id: 'espresso-flat-white',
    name: 'Flat White',
    category: 'Espresso',
    price: 14,
    description: 'Double ristretto espresso with velvety steamed microfoam.',
  },
  {
    id: 'espresso-cappuccino',
    name: 'Cappuccino',
    category: 'Espresso',
    price: 14,
    description: 'Rich espresso balanced with steamed milk and dense textured foam.',
  },

  // Matcha
  {
    id: 'matcha-palm-regular-milk',
    name: 'Palm Matcha (Regular milk)',
    category: 'Matcha',
    price: 19,
    description: 'Signature Palm Metric ceremonial matcha whisked with fresh regular milk.',
  },
  {
    id: 'matcha-palm-coconut-milk',
    name: 'Palm Matcha (Coconut milk)',
    category: 'Matcha',
    price: 19,
    description: 'Signature Palm Metric ceremonial matcha whisked with creamy coconut milk.',
  },
  {
    id: 'matcha-iced',
    name: 'Iced Matcha',
    category: 'Matcha',
    price: 17,
    description: 'Chilled ceremonial-grade matcha poured over ice and milk.',
  },

  // Specialty
  {
    id: 'specialty-iced-spanish-latte',
    name: 'Iced Spanish Latte',
    category: 'Specialty',
    price: 16,
    description: 'Chilled double espresso layered with cold milk and sweetened condensed cream.',
  },
  {
    id: 'specialty-iced-white-mocha',
    name: 'Iced White Mocha',
    category: 'Specialty',
    price: 17,
    description: 'Chilled espresso blended with white chocolate sauce and cold milk over ice.',
  },

  // Cold Drinks
  {
    id: 'cold-hibiscus-small',
    name: 'Hibiscus Small',
    category: 'Cold Drinks',
    price: 8,
    description: 'Refreshing chilled floral hibiscus infusion served in a small cup.',
  },
  {
    id: 'cold-hibiscus-large',
    name: 'Hibiscus Large',
    category: 'Cold Drinks',
    price: 10,
    description: 'Refreshing chilled floral hibiscus infusion served in a large cup.',
  },
  {
    id: 'cold-iced-tea-peach',
    name: 'Iced Tea Peach',
    category: 'Cold Drinks',
    price: 10,
    description: 'Crisp brewed iced tea infused with ripe peach.',
  },

  // Food
  {
    id: 'food-palm-muffin',
    name: 'Palm Muffin',
    category: 'Food',
    price: 9,
    description: 'House-baked signature Palm Metric muffin.',
  },
  {
    id: 'food-cookies',
    name: 'Cookies',
    category: 'Food',
    price: 10,
    description: 'Freshly baked artisanal cookies with crisp edges and soft center.',
  },
  {
    id: 'food-golden-crown',
    name: 'Golden Crown',
    category: 'Food',
    price: 18,
    description: 'Flaky laminated pastry baked golden and delicately glazed.',
  },
  {
    id: 'food-pudding',
    name: 'Pudding',
    category: 'Food',
    price: 16,
    description: 'Smooth, rich house-crafted dessert pudding.',
  },
  {
    id: 'food-croissant',
    name: 'Croissant',
    category: 'Food',
    price: 6,
    description: 'Classic French-butter croissant baked fresh daily.',
  },
];

export interface DefaultCategorySeed {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  allowMilkOption: boolean;
  allowTemperature: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  {
    id: 'cat-v60',
    key: 'V60',
    nameEn: 'V60',
    nameAr: 'قهوة V60',
    sortOrder: 0,
    allowMilkOption: true,
    allowTemperature: true,
  },
  {
    id: 'cat-espresso',
    key: 'Espresso',
    nameEn: 'Espresso',
    nameAr: 'إسبريسو',
    sortOrder: 1,
    allowMilkOption: true,
    allowTemperature: true,
  },
  {
    id: 'cat-matcha',
    key: 'Matcha',
    nameEn: 'Matcha',
    nameAr: 'ماتشا',
    sortOrder: 2,
    allowMilkOption: true,
    allowTemperature: true,
  },
  {
    id: 'cat-specialty',
    key: 'Specialty',
    nameEn: 'Specialty',
    nameAr: 'مشروبات خاصة',
    sortOrder: 3,
    allowMilkOption: true,
    allowTemperature: true,
  },
  {
    id: 'cat-cold-drinks',
    key: 'Cold Drinks',
    nameEn: 'Cold Drinks',
    nameAr: 'مشروبات باردة',
    sortOrder: 4,
    allowMilkOption: false,
    allowTemperature: false,
  },
  {
    id: 'cat-food',
    key: 'Food',
    nameEn: 'Food',
    nameAr: 'المخبوزات والحلويات',
    sortOrder: 5,
    allowMilkOption: false,
    allowTemperature: false,
  },
];

export async function syncDefaultCategories(
  existingKeys: Set<string>,
  existingIds: Set<string> = new Set()
): Promise<number> {
  const missing = DEFAULT_CATEGORIES.filter(
    (cat) => !existingIds.has(cat.id) && !existingKeys.has(cat.key)
  );
  if (missing.length === 0) return 0;

  const batch = writeBatch(db);
  for (const cat of missing) {
    const ref = doc(db, 'categories', cat.id);
    batch.set(ref, {
      key: cat.key,
      nameEn: cat.nameEn,
      nameAr: cat.nameAr,
      sortOrder: cat.sortOrder,
      isActive: true,
      allowMilkOption: cat.allowMilkOption,
      allowTemperature: cat.allowTemperature,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return missing.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'categories');
  }
}

export async function syncPalmMetricMenu(existingIds: Set<string>): Promise<number> {
  const missingItems = PALM_METRIC_MENU.filter((item) => !existingIds.has(item.id));
  if (missingItems.length === 0) return 0;

  const batch = writeBatch(db);
  for (const item of missingItems) {
    const ref = doc(db, 'menu', item.id);
    batch.set(ref, {
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description,
      inStock: true,
      imageUrl: '',
      storagePath: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return missingItems.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'menu');
  }
}
