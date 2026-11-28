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

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Ready',
  'Completed',
];

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
];

export type BillboardMediaType = 'image' | 'video';

export type AdminTab = 'requests' | 'orders' | 'menu' | 'billboard' | 'customer';

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
  isAvailable?: boolean;
  available?: boolean;
  outOfStock?: boolean;
  stockQuantity?: number;
  stockCount?: number;
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
  nameAr?: string;
  price: number;
  basePrice?: number;
  customizationTotal?: number;
  quantity: number;
  milkOption?: MilkOption;
  milkExtraPrice?: number;
  temperature?: TemperatureOption;
  selectedCustomizations?: SelectedCustomizationOption[];
  specialInstructions?: string;
  note?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerUid: string;
  customerName: string;
  customerContact: string;
  items: OrderLineItem[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  totalBill: number;
  currency?: 'SAR';
  orderType?: 'pickup' | 'delivery';
  paymentMethod?: 'pay_on_pickup';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'pay_at_pickup';
  status: OrderStatus;
  notes?: string;
  sourceApp?: string;
  lang?: 'ar' | 'en';
  idempotencyKey?: string;
  pricingVersion?: number;
  sourceRequestId?: string;
  requestId?: string;
  requestReference?: string;
  approvedBy?: string;
  approvedByEmail?: string;
  approvedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type OrderRequestStatus =
  | 'pending_review'
  | 'reviewing'
  | 'verified'
  | 'rejected'
  | 'order_created';

export const ORDER_REQUEST_STATUSES: OrderRequestStatus[] = [
  'pending_review',
  'reviewing',
  'verified',
  'rejected',
  'order_created',
];

export type OrderRequestReviewStatus =
  | 'unreviewed'
  | 'in_review'
  | 'verified'
  | 'needs_attention'
  | 'approved'
  | 'rejected';

export interface OrderRequestSubmittedCustomization {
  groupId: string;
  groupName?: string;
  groupNameAr?: string;
  optionId: string;
  optionName?: string;
  optionNameAr?: string;
  additionalPrice?: number;
}

export interface OrderRequestItemInput {
  itemId: string;
  productId?: string;
  name?: string;
  nameAr?: string;
  quantity: number;
  milkOption?: MilkOption;
  temperature?: TemperatureOption;
  selectedCustomizations?: OrderRequestSubmittedCustomization[];
  selectedByGroup?: Record<string, string[]>;
  specialInstructions?: string;
  // Client-submitted figures are informational only and NEVER trusted for official pricing
  submittedUnitPrice?: number;
  submittedLineTotal?: number;
  price?: number;
}

export interface PricingValidationIssue {
  code:
    | 'UNKNOWN_PRODUCT'
    | 'OUT_OF_STOCK'
    | 'INSUFFICIENT_STOCK'
    | 'INVALID_CATALOG_PRICE'
    | 'INVALID_QUANTITY'
    | 'CUSTOMIZATIONS_DISABLED'
    | 'INVALID_OR_DISABLED_GROUP'
    | 'INVALID_OR_DISABLED_OPTION'
    | 'REQUIRED_GROUP_MISSING'
    | 'MIN_SELECTIONS_NOT_MET'
    | 'MAX_SELECTIONS_EXCEEDED'
    | 'BROKEN_REQUIRED_GROUP'
    | 'SPECIAL_INSTRUCTIONS_DISABLED'
    | 'INVALID_MODIFIER'
    | 'CLIENT_PRICE_MISMATCH'
    | 'EMPTY_ITEMS'
    | 'TOO_MANY_ITEMS';
  severity: 'error' | 'warning';
  itemId?: string;
  itemName?: string;
  en: string;
  ar: string;
}

export interface VerifiedOrderLineItem extends OrderLineItem {
  basePrice: number;
  customizationTotal: number;
  lineTotal: number;
  inStockVerified: boolean;
  submittedUnitPrice?: number;
  priceAdjustedFromSubmitted?: boolean;
}

export interface VerifiedPricingLineSummary {
  itemId: string;
  name: string;
  nameAr?: string;
  quantity: number;
  basePriceSar: number;
  customizationTotalSar: number;
  unitPriceSar: number;
  lineTotalSar: number;
  selectedCustomizations?: SelectedCustomizationOption[];
  temperature?: TemperatureOption;
  milkOption?: MilkOption;
  milkExtraPrice?: number;
  specialInstructions?: string;
  note: string;
  imageUrl: string;
  inStock: boolean;
}

export interface VerifiedPricingBreakdown {
  currency: 'SAR';
  orderType?: 'pickup';
  pricingVersion: number;
  subtotalHalalas: number;
  discountHalalas: number;
  taxHalalas: number;
  totalHalalas: number;
  subtotalSar: number;
  discountSar: number;
  taxSar: number;
  totalSar: number;
  totalBillSar?: number;
  itemCount?: number;
  verifiedAtMs?: number;
  verifiedByUid?: string;
  verifiedByEmail?: string;
  items?: VerifiedPricingLineSummary[];
  appliedDiscountLabel?: string;
  appliedTaxRatePercent?: number;
  clientSubmittedTotalSar?: number;
  clientPriceMismatch: boolean;
  verifiedAtIso: string;
}

export interface PricingConfigSettings {
  taxEnabled?: boolean;
  taxRatePercent?: number;
  discountEnabled?: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountLabel?: string;
}

export type OrderRequestAuditAction =
  | 'submitted'
  | 'start_review'
  | 'verify'
  | 'verify_request'
  | 'price_verified'
  | 'price_verification'
  | 'approve'
  | 'approve_and_promote'
  | 'order_promoted'
  | 'order_promotion'
  | 'reject'
  | 'reject_request'
  | 'duplicate_approval_blocked'
  | 'verification_blocked';

export interface OrderRequestAuditEntry {
  id: string;
  requestId: string;
  requestReference: string;
  action: OrderRequestAuditAction;
  actorUid: string;
  actorEmail?: string;
  actorRole: 'admin' | 'customer' | 'system';
  adminUid?: string;
  adminEmail?: string;
  fromStatus?: OrderRequestStatus;
  toStatus: OrderRequestStatus;
  previousStatus?: OrderRequestStatus;
  newStatus?: OrderRequestStatus;
  note?: string;
  details?: string;
  rejectionReason?: string;
  reason?: string;
  approvedOrderId?: string;
  approvedOrderNumber?: string;
  verifiedTotalSar?: number;
  createdAtIso: string;
  createdAt?: Timestamp | null;
}

export interface OrderRequest {
  id: string;
  requestId?: string;
  requestReference: string;
  customerUid: string;
  customerName: string;
  customerContact: string;
  orderType?: 'pickup';
  pickupType?: 'pickup';
  currency?: 'SAR';
  pickupWindow?: string;
  items: OrderRequestItemInput[];
  notes?: string;
  orderNote?: string;
  status: OrderRequestStatus;
  reviewStatus: OrderRequestReviewStatus;
  requestSource?: string;
  sourceApp?: string;
  lang?: 'ar' | 'en';
  clientEstimatedTotal?: number;
  verifiedTotalSar?: number;
  verifiedPricing?: VerifiedPricingBreakdown;
  verifiedItems?: VerifiedOrderLineItem[];
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: Timestamp | null;
  verifiedBy?: string;
  verifiedByEmail?: string;
  verifiedAt?: Timestamp | null;
  approvedOrderId?: string;
  approvedOrderNumber?: string;
  approvedBy?: string;
  approvedByEmail?: string;
  approvedAt?: Timestamp | null;
  rejectedBy?: string;
  rejectedByEmail?: string;
  rejectedAt?: Timestamp | null;
  rejectionReason?: string;
  auditTrail?: OrderRequestAuditEntry[];
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
  orderRequest: {
    referenceMaxLength: 32,
    rejectionReasonMaxLength: 300,
    notesMaxLength: 300,
    maxItems: 50,
    maxQuantityPerItem: 50,
    referencePattern: /^REQ-[a-zA-Z0-9_-]+$/,
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
