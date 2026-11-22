import { Timestamp } from 'firebase/firestore';

export type MenuCategory = string;

export const DEFAULT_MENU_CATEGORIES: string[] = [
  'V60',
  'Espresso',
  'Matcha',
  'Specialty',
  'Cold Drinks',
  'Food',
];

export const MENU_CATEGORIES = DEFAULT_MENU_CATEGORIES;

export type MilkOption = 'none' | 'regular' | 'coconut';
export type TemperatureOption = 'Hot' | 'Cold';

export interface CategoryItem {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  allowMilkOption: boolean;
  allowTemperature: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CoffeeOptionsSettings {
  milkSelectionEnabled: boolean;
  coconutMilkExtraPrice: number;
  hotColdSelectionEnabled: boolean;
  updatedAt?: Timestamp | null;
}

export const DEFAULT_COFFEE_OPTIONS: CoffeeOptionsSettings = {
  milkSelectionEnabled: true,
  coconutMilkExtraPrice: 3,
  hotColdSelectionEnabled: true,
};

export function formatPrice(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = Number.isInteger(safe) ? String(safe) : safe.toFixed(2);
  return `${formatted} ﷼`;
}

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Ready',
  'Completed',
];

export type BillboardMediaType = 'image' | 'video';

export type AdminTab = 'orders' | 'menu' | 'billboard' | 'customer';

export const CUSTOMER_APP_DOMAIN = 'tashflow.github.io/Palm-Metric/';
export const CUSTOMER_APP_URL = `https://${CUSTOMER_APP_DOMAIN}`;

export interface MenuItem {
  id: string;
  name: string;
  nameAr?: string;
  category: MenuCategory;
  price: number;
  description: string;
  descriptionAr?: string;
  inStock: boolean;
  imageUrl: string;
  storagePath: string;
  allowMilkOption?: boolean;
  coconutMilkPrice?: number;
  allowTemperature?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface BillboardAd {
  id: string;
  title: string;
  mediaType: BillboardMediaType;
  mediaUrl: string;
  storagePath: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type CustomizationGroupType = 'single' | 'multiple';

export interface CustomizationOption {
  id: string;
  name: string;
  nameAr: string;
  additionalPrice: number;
  enabled: boolean;
  isDefault: boolean;
  displayOrder: number;
}

export interface CustomizationGroup {
  id: string;
  name: string;
  nameAr: string;
  type: CustomizationGroupType;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  enabled: boolean;
  options: CustomizationOption[];
}

export interface ProductCustomization {
  productId: string;
  enabled: boolean;
  schemaVersion: number;
  allowSpecialInstructions: boolean;
  updatedBy: string;
  updatedAt?: Timestamp | null;
  groups: CustomizationGroup[];
}

export interface SelectedCustomizationOption {
  groupId: string;
  groupName: string;
  groupNameAr?: string;
  optionId: string;
  optionName: string;
  optionNameAr?: string;
  additionalPrice: number;
}

export interface OrderLineItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  milkOption?: MilkOption;
  milkExtraPrice?: number;
  temperature?: TemperatureOption;
  selectedCustomizations?: SelectedCustomizationOption[];
  specialInstructions?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerUid: string;
  customerName: string;
  customerContact: string;
  items: OrderLineItem[];
  totalBill: number;
  status: OrderStatus;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export const VALIDATION_LIMITS = {
  menuItem: {
    nameMaxLength: 80,
    descriptionMaxLength: 400,
    priceMax: 10000,
    coconutMilkPriceMax: 500,
    categoryMaxLength: 60,
    imageUrlMaxLength: 2048,
    storagePathMaxLength: 512,
  },
  category: {
    nameMaxLength: 60,
    sortOrderMax: 1000,
  },
  billboard: {
    titleMaxLength: 120,
    mediaUrlMaxLength: 2048,
    storagePathMaxLength: 512,
  },
  order: {
    orderNumberMaxLength: 32,
    customerNameMaxLength: 80,
    customerContactMaxLength: 80,
    notesMaxLength: 240,
    maxItems: 50,
    orderNumberPattern: /^[a-zA-Z0-9_-]+$/,
  },
  productCustomization: {
    productIdMaxLength: 128,
    idMaxLength: 60,
    nameMaxLength: 80,
    maxGroups: 8,
    maxOptionsPerGroup: 10,
    maxAdditionalPrice: 500,
    maxDisplayOrder: 100,
    specialInstructionsMaxLength: 240,
    idPattern: /^[a-zA-Z0-9_-]+$/,
  },
} as const;
