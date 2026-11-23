import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_COFFEE_OPTIONS,
  MenuItem,
  Order,
  OrderLineItem,
  OrderRequest,
  OrderRequestAuditAction,
  OrderRequestAuditEntry,
  OrderRequestItemInput,
  OrderRequestReviewStatus,
  OrderRequestStatus,
  PricingConfigSettings,
  PricingValidationIssue,
  ProductCustomization,
  VALIDATION_LIMITS,
} from '../types';
import {
  AUTHORITATIVE_PRICING_VERSION,
  AuthoritativeCatalogContext,
  AuthoritativeVerificationResult,
  verifyAndPriceOrderRequest,
} from './authoritativePricing';
import { sanitizeFirestoreCustomization } from './productCustomizations';

export type OrderWorkflowErrorCode =
  | 'REQUEST_NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'ALREADY_REJECTED'
  | 'ALREADY_PROMOTED_CONFLICT'
  | 'REJECTION_REASON_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'UNAUTHORIZED_ADMIN';

export class OrderWorkflowError extends Error {
  readonly code: OrderWorkflowErrorCode;
  readonly issues: PricingValidationIssue[];

  constructor(
    code: OrderWorkflowErrorCode,
    message: string,
    issues: PricingValidationIssue[] = []
  ) {
    super(message);
    this.name = 'OrderWorkflowError';
    this.code = code;
    this.issues = issues;
  }
}

export function sanitizeIdSegment(raw: string, fallback = 'req'): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || fallback;
}

export function getDeterministicOrderId(requestId: string): string {
  return `ord_${sanitizeIdSegment(requestId)}`.slice(0, 128);
}

export function computeDeterministicNumericSuffix(seed: string): string {
  // FNV-1a 32-bit hash mapped deterministically into 6 digits (100000..999999)
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const sixDigits = 100000 + (unsigned % 900000);
  return String(sixDigits);
}

export function getOfficialOrderNumber(
  requestId: string,
  requestReference?: string
): string {
  const digits = computeDeterministicNumericSuffix(
    `${requestId}::${requestReference || ''}`
  );
  return `PM-${digits}`;
}

export function generateRequestReference(): string {
  const now = new Date();
  const yymmdd = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${yymmdd}-${rand}`;
}

function normalizeStatus(rawStatus: unknown): OrderRequestStatus {
  const val = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  switch (val) {
    case 'under_review':
    case 'in_review':
    case 'reviewing':
      return 'under_review';
    case 'verified':
    case 'price_verified':
      return 'verified';
    case 'rejected':
    case 'declined':
      return 'rejected';
    case 'order_created':
    case 'approved':
    case 'promoted':
      return 'order_created';
    case 'pending_review':
    case 'pending':
    case 'submitted':
    default:
      return 'pending_review';
  }
}

function normalizeReviewStatus(
  rawReview: unknown,
  status: OrderRequestStatus
): OrderRequestReviewStatus {
  const val = typeof rawReview === 'string' ? rawReview.trim().toLowerCase() : '';
  if (
    val === 'unreviewed' ||
    val === 'in_review' ||
    val === 'verified' ||
    val === 'needs_attention' ||
    val === 'approved' ||
    val === 'rejected'
  ) {
    return val;
  }
  switch (status) {
    case 'under_review':
      return 'in_review';
    case 'verified':
      return 'verified';
    case 'rejected':
      return 'rejected';
    case 'order_created':
      return 'approved';
    default:
      return 'unreviewed';
  }
}

export function normalizeOrderRequest(
  id: string,
  raw: Record<string, unknown>
): OrderRequest {
  const status = normalizeStatus(raw.status);
  const reviewStatus = normalizeReviewStatus(raw.reviewStatus, status);
  const rawRef =
    typeof raw.requestReference === 'string' && raw.requestReference.trim()
      ? raw.requestReference.trim()
      : typeof raw.reference === 'string' && raw.reference.trim()
      ? raw.reference.trim()
      : `REQ-${id.slice(0, 8).toUpperCase()}`;

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: OrderRequestItemInput[] = rawItems
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      itemId:
        typeof entry.itemId === 'string'
          ? entry.itemId
          : typeof entry.productId === 'string'
          ? entry.productId
          : '',
      ...(typeof entry.productId === 'string' ? { productId: entry.productId } : {}),
      ...(typeof entry.name === 'string' ? { name: entry.name } : {}),
      ...(typeof entry.nameAr === 'string' ? { nameAr: entry.nameAr } : {}),
      quantity:
        typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
          ? entry.quantity
          : 1,
      ...(entry.milkOption === 'none' ||
      entry.milkOption === 'regular' ||
      entry.milkOption === 'coconut'
        ? { milkOption: entry.milkOption }
        : {}),
      ...(entry.temperature === 'Hot' || entry.temperature === 'Cold'
        ? { temperature: entry.temperature }
        : {}),
      ...(Array.isArray(entry.selectedCustomizations)
        ? {
            selectedCustomizations: entry.selectedCustomizations.filter(
              (c): c is NonNullable<OrderRequestItemInput['selectedCustomizations']>[number] =>
                Boolean(c && typeof c === 'object')
            ),
          }
        : {}),
      ...(entry.selectedByGroup && typeof entry.selectedByGroup === 'object'
        ? { selectedByGroup: entry.selectedByGroup as Record<string, string[]> }
        : {}),
      ...(typeof entry.specialInstructions === 'string'
        ? { specialInstructions: entry.specialInstructions }
        : {}),
      ...(typeof entry.submittedUnitPrice === 'number'
        ? { submittedUnitPrice: entry.submittedUnitPrice }
        : {}),
      ...(typeof entry.submittedLineTotal === 'number'
        ? { submittedLineTotal: entry.submittedLineTotal }
        : {}),
      ...(typeof entry.price === 'number' ? { price: entry.price } : {}),
    }));

  const clientEstimatedTotal =
    typeof raw.clientEstimatedTotal === 'number' && Number.isFinite(raw.clientEstimatedTotal)
      ? raw.clientEstimatedTotal
      : typeof raw.estimatedTotal === 'number' && Number.isFinite(raw.estimatedTotal)
      ? raw.estimatedTotal
      : typeof raw.totalBill === 'number' && Number.isFinite(raw.totalBill)
      ? raw.totalBill
      : undefined;

  return {
    id,
    requestReference: rawRef,
    customerUid: typeof raw.customerUid === 'string' ? raw.customerUid : '',
    customerName: typeof raw.customerName === 'string' ? raw.customerName : '',
    customerContact: typeof raw.customerContact === 'string' ? raw.customerContact : '',
    pickupType: 'pickup',
    ...(typeof raw.pickupWindow === 'string' ? { pickupWindow: raw.pickupWindow } : {}),
    items,
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
    status,
    reviewStatus,
    ...(typeof raw.sourceApp === 'string' ? { sourceApp: raw.sourceApp } : {}),
    ...(raw.lang === 'ar' || raw.lang === 'en' ? { lang: raw.lang } : {}),
    ...(clientEstimatedTotal !== undefined ? { clientEstimatedTotal } : {}),
    ...(raw.verifiedPricing && typeof raw.verifiedPricing === 'object'
      ? { verifiedPricing: raw.verifiedPricing as OrderRequest['verifiedPricing'] }
      : {}),
    ...(Array.isArray(raw.verifiedItems)
      ? { verifiedItems: raw.verifiedItems as OrderRequest['verifiedItems'] }
      : {}),
    ...(typeof raw.reviewedBy === 'string' ? { reviewedBy: raw.reviewedBy } : {}),
    ...(typeof raw.reviewedByEmail === 'string' ? { reviewedByEmail: raw.reviewedByEmail } : {}),
    reviewedAt: (raw.reviewedAt as Timestamp | null) ?? null,
    ...(typeof raw.verifiedBy === 'string' ? { verifiedBy: raw.verifiedBy } : {}),
    ...(typeof raw.verifiedByEmail === 'string' ? { verifiedByEmail: raw.verifiedByEmail } : {}),
    verifiedAt: (raw.verifiedAt as Timestamp | null) ?? null,
    ...(typeof raw.approvedOrderId === 'string' ? { approvedOrderId: raw.approvedOrderId } : {}),
    ...(typeof raw.approvedOrderNumber === 'string'
      ? { approvedOrderNumber: raw.approvedOrderNumber }
      : {}),
    ...(typeof raw.approvedBy === 'string' ? { approvedBy: raw.approvedBy } : {}),
    ...(typeof raw.approvedByEmail === 'string' ? { approvedByEmail: raw.approvedByEmail } : {}),
    approvedAt: (raw.approvedAt as Timestamp | null) ?? null,
    ...(typeof raw.rejectedBy === 'string' ? { rejectedBy: raw.rejectedBy } : {}),
    ...(typeof raw.rejectedByEmail === 'string' ? { rejectedByEmail: raw.rejectedByEmail } : {}),
    rejectedAt: (raw.rejectedAt as Timestamp | null) ?? null,
    ...(typeof raw.rejectionReason === 'string' ? { rejectionReason: raw.rejectionReason } : {}),
    ...(Array.isArray(raw.auditTrail)
      ? { auditTrail: raw.auditTrail as OrderRequestAuditEntry[] }
      : {}),
    createdAt: (raw.createdAt as Timestamp | null) ?? null,
    updatedAt: (raw.updatedAt as Timestamp | null) ?? null,
  };
}

export interface OrderRequestTransactionContext {
  getOrderRequest(requestId: string): Promise<OrderRequest | null>;
  getOrder(orderId: string): Promise<Order | null>;
  getCatalogContext(itemIds: string[]): Promise<AuthoritativeCatalogContext>;
  updateOrderRequest(requestId: string, patch: Record<string, unknown>): void;
  setOrder(orderId: string, orderData: Record<string, unknown>): void;
  addAuditLog(requestId: string, entry: OrderRequestAuditEntry): void;
  serverTimestamp(): unknown;
  nowIso(): string;
}

export interface OrderRequestStore {
  runTransaction<T>(fn: (tx: OrderRequestTransactionContext) => Promise<T>): Promise<T>;
}

export interface AdminActor {
  uid: string;
  email?: string;
}

function assertValidAdminActor(actor: AdminActor): void {
  if (!actor || typeof actor.uid !== 'string' || !actor.uid.trim()) {
    throw new OrderWorkflowError(
      'UNAUTHORIZED_ADMIN',
      'Authenticated Admin UID is required for order request actions.'
    );
  }
}

function buildAuditEntry(params: {
  requestId: string;
  requestReference: string;
  action: OrderRequestAuditAction;
  actor: AdminActor;
  fromStatus: OrderRequestStatus;
  toStatus: OrderRequestStatus;
  note?: string;
  rejectionReason?: string;
  approvedOrderId?: string;
  approvedOrderNumber?: string;
  verifiedTotalSar?: number;
  createdAtIso: string;
  serverTs: unknown;
}): OrderRequestAuditEntry {
  const rand = Math.random().toString(36).slice(2, 7);
  const id = `audit_${Date.now()}_${params.action}_${rand}`;
  return {
    id,
    requestId: params.requestId,
    requestReference: params.requestReference,
    action: params.action,
    actorUid: params.actor.uid,
    ...(params.actor.email ? { actorEmail: params.actor.email } : {}),
    actorRole: 'admin',
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    ...(params.note ? { note: params.note.slice(0, 240) } : {}),
    ...(params.rejectionReason
      ? { rejectionReason: params.rejectionReason.slice(0, 300) }
      : {}),
    ...(params.approvedOrderId ? { approvedOrderId: params.approvedOrderId } : {}),
    ...(params.approvedOrderNumber ? { approvedOrderNumber: params.approvedOrderNumber } : {}),
    ...(typeof params.verifiedTotalSar === 'number'
      ? { verifiedTotalSar: params.verifiedTotalSar }
      : {}),
    createdAtIso: params.createdAtIso,
    createdAt: params.serverTs as Timestamp | null,
  };
}

function appendAuditSummary(
  existingTrail: OrderRequestAuditEntry[] | undefined,
  nextEntries: OrderRequestAuditEntry[]
): OrderRequestAuditEntry[] {
  const prev = Array.isArray(existingTrail) ? existingTrail : [];
  // Store lightweight summary snapshots (without nested Firestore sentinel objects if needed, keeping iso timestamp)
  const sanitizedNew = nextEntries.map((e) => {
    const copy = { ...e };
    delete copy.createdAt;
    return copy;
  });
  return [...prev, ...sanitizedNew].slice(-25);
}

export async function startOrderRequestReview(params: {
  store: OrderRequestStore;
  requestId: string;
  actor: AdminActor;
  note?: string;
}): Promise<OrderRequest> {
  assertValidAdminActor(params.actor);
  return params.store.runTransaction(async (tx) => {
    const req = await tx.getOrderRequest(params.requestId);
    if (!req) {
      throw new OrderWorkflowError(
        'REQUEST_NOT_FOUND',
        `Order request "${params.requestId}" was not found.`
      );
    }
    if (req.status === 'rejected') {
      throw new OrderWorkflowError(
        'ALREADY_REJECTED',
        'Rejected requests cannot be moved back into review.'
      );
    }
    if (req.status === 'order_created') {
      throw new OrderWorkflowError(
        'INVALID_STATE_TRANSITION',
        'Promoted requests already have a live official order.'
      );
    }
    if (req.status === 'under_review') {
      return req;
    }
    if (req.status === 'verified') {
      return req;
    }

    const ts = tx.serverTimestamp();
    const nowIso = tx.nowIso();
    const auditEntry = buildAuditEntry({
      requestId: req.id,
      requestReference: req.requestReference,
      action: 'start_review',
      actor: params.actor,
      fromStatus: req.status,
      toStatus: 'under_review',
      note: params.note,
      createdAtIso: nowIso,
      serverTs: ts,
    });
    const nextTrail = appendAuditSummary(req.auditTrail, [auditEntry]);

    tx.updateOrderRequest(req.id, {
      status: 'under_review',
      reviewStatus: 'in_review',
      reviewedBy: params.actor.uid,
      ...(params.actor.email ? { reviewedByEmail: params.actor.email } : {}),
      reviewedAt: ts,
      auditTrail: nextTrail,
      updatedAt: ts,
    });
    tx.addAuditLog(req.id, auditEntry);

    return {
      ...req,
      status: 'under_review',
      reviewStatus: 'in_review',
      reviewedBy: params.actor.uid,
      ...(params.actor.email ? { reviewedByEmail: params.actor.email } : {}),
      auditTrail: nextTrail,
    };
  });
}

export async function verifyOrderRequest(params: {
  store: OrderRequestStore;
  requestId: string;
  actor: AdminActor;
  note?: string;
}): Promise<{ request: OrderRequest; verification: AuthoritativeVerificationResult }> {
  assertValidAdminActor(params.actor);
  return params.store.runTransaction(async (tx) => {
    const req = await tx.getOrderRequest(params.requestId);
    if (!req) {
      throw new OrderWorkflowError(
        'REQUEST_NOT_FOUND',
        `Order request "${params.requestId}" was not found.`
      );
    }
    if (req.status === 'rejected') {
      throw new OrderWorkflowError(
        'ALREADY_REJECTED',
        'Rejected requests cannot be verified.'
      );
    }
    if (req.status === 'order_created') {
      throw new OrderWorkflowError(
        'INVALID_STATE_TRANSITION',
        'Order has already been created for this request.'
      );
    }

    const itemIds = Array.from(
      new Set(
        req.items
          .map((i) => (i.itemId || i.productId || '').trim())
          .filter(Boolean)
      )
    );
    const catalog = await tx.getCatalogContext(itemIds);
    const nowIso = tx.nowIso();
    const verification = verifyAndPriceOrderRequest(req, catalog, nowIso);

    if (!verification.ok) {
      throw new OrderWorkflowError(
        'VERIFICATION_FAILED',
        verification.blockingIssues.map((i) => i.en).join(' '),
        verification.blockingIssues
      );
    }

    const ts = tx.serverTimestamp();
    const verifyEntry = buildAuditEntry({
      requestId: req.id,
      requestReference: req.requestReference,
      action: 'verify',
      actor: params.actor,
      fromStatus: req.status,
      toStatus: 'verified',
      note: params.note,
      verifiedTotalSar: verification.breakdown.totalSar,
      createdAtIso: nowIso,
      serverTs: ts,
    });
    const priceEntry = buildAuditEntry({
      requestId: req.id,
      requestReference: req.requestReference,
      action: 'price_verified',
      actor: params.actor,
      fromStatus: req.status,
      toStatus: 'verified',
      note: `Verified total ${verification.breakdown.totalSar} SAR`,
      verifiedTotalSar: verification.breakdown.totalSar,
      createdAtIso: nowIso,
      serverTs: ts,
    });
    const nextTrail = appendAuditSummary(req.auditTrail, [verifyEntry, priceEntry]);

    tx.updateOrderRequest(req.id, {
      status: 'verified',
      reviewStatus: 'verified',
      verifiedPricing: verification.breakdown,
      verifiedItems: verification.verifiedItems,
      verifiedBy: params.actor.uid,
      ...(params.actor.email ? { verifiedByEmail: params.actor.email } : {}),
      verifiedAt: ts,
      ...(req.reviewedBy ? {} : { reviewedBy: params.actor.uid, reviewedAt: ts }),
      auditTrail: nextTrail,
      updatedAt: ts,
    });
    tx.addAuditLog(req.id, verifyEntry);
    tx.addAuditLog(req.id, priceEntry);

    return {
      request: {
        ...req,
        status: 'verified',
        reviewStatus: 'verified',
        verifiedPricing: verification.breakdown,
        verifiedItems: verification.verifiedItems,
        verifiedBy: params.actor.uid,
        ...(params.actor.email ? { verifiedByEmail: params.actor.email } : {}),
        auditTrail: nextTrail,
      },
      verification,
    };
  });
}

export interface ApprovePromotionResult {
  idempotentReplay: boolean;
  order: Order;
  request: OrderRequest;
  verification?: AuthoritativeVerificationResult;
}

export async function approveAndPromoteOrderRequest(params: {
  store: OrderRequestStore;
  requestId: string;
  actor: AdminActor;
  note?: string;
}): Promise<ApprovePromotionResult> {
  assertValidAdminActor(params.actor);
  const deterministicOrderId = getDeterministicOrderId(params.requestId);

  return params.store.runTransaction(async (tx) => {
    const req = await tx.getOrderRequest(params.requestId);
    if (!req) {
      throw new OrderWorkflowError(
        'REQUEST_NOT_FOUND',
        `Order request "${params.requestId}" was not found.`
      );
    }

    const existingOfficialOrder = await tx.getOrder(deterministicOrderId);

    if (req.status === 'rejected') {
      throw new OrderWorkflowError(
        'ALREADY_REJECTED',
        'Rejected order requests cannot be promoted into official orders.'
      );
    }

    if (req.status === 'order_created') {
      if (req.approvedOrderId === deterministicOrderId && existingOfficialOrder) {
        return {
          idempotentReplay: true,
          order: existingOfficialOrder,
          request: req,
        };
      }
      if (existingOfficialOrder) {
        return {
          idempotentReplay: true,
          order: existingOfficialOrder,
          request: req,
        };
      }
      throw new OrderWorkflowError(
        'ALREADY_PROMOTED_CONFLICT',
        `Order request "${req.requestReference}" is already marked order_created.`
      );
    }

    if (existingOfficialOrder) {
      if (existingOfficialOrder.requestId === req.id) {
        return {
          idempotentReplay: true,
          order: existingOfficialOrder,
          request: req,
        };
      }
      throw new OrderWorkflowError(
        'ALREADY_PROMOTED_CONFLICT',
        `Target official order "${deterministicOrderId}" already exists.`
      );
    }

    // Re-read authoritative catalog docs & recompute prices inside transaction
    const itemIds = Array.from(
      new Set(
        req.items
          .map((i) => (i.itemId || i.productId || '').trim())
          .filter(Boolean)
      )
    );
    const catalog = await tx.getCatalogContext(itemIds);
    const nowIso = tx.nowIso();
    const verification = verifyAndPriceOrderRequest(req, catalog, nowIso);

    if (!verification.ok) {
      throw new OrderWorkflowError(
        'VERIFICATION_FAILED',
        verification.blockingIssues.map((i) => i.en).join(' '),
        verification.blockingIssues
      );
    }

    const orderNumber = getOfficialOrderNumber(req.id, req.requestReference);
    const ts = tx.serverTimestamp();

    const canonicalOrderItems: OrderLineItem[] = verification.verifiedItems.map((vi) => ({
      itemId: vi.itemId,
      name: vi.name,
      ...(vi.nameAr ? { nameAr: vi.nameAr } : {}),
      price: vi.price,
      basePrice: vi.basePrice,
      customizationTotal: vi.customizationTotal,
      quantity: vi.quantity,
      ...(vi.milkOption ? { milkOption: vi.milkOption } : {}),
      ...(vi.milkExtraPrice !== undefined ? { milkExtraPrice: vi.milkExtraPrice } : {}),
      ...(vi.temperature ? { temperature: vi.temperature } : {}),
      ...(vi.selectedCustomizations && vi.selectedCustomizations.length > 0
        ? { selectedCustomizations: vi.selectedCustomizations }
        : {}),
      ...(vi.specialInstructions ? { specialInstructions: vi.specialInstructions } : {}),
      ...(vi.note ? { note: vi.note } : {}),
      ...(vi.imageUrl ? { imageUrl: vi.imageUrl } : {}),
    }));

    const pickupNotes = [
      req.pickupWindow ? `Pickup (${req.pickupWindow})` : 'Pickup',
      req.notes,
      params.note ? `Admin: ${params.note}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, VALIDATION_LIMITS.order.notesMaxLength);

    const officialOrderPayload: Record<string, unknown> = {
      orderNumber,
      customerUid: req.customerUid,
      customerName: req.customerName,
      customerContact: req.customerContact,
      items: canonicalOrderItems,
      subtotal: verification.breakdown.subtotalSar,
      discountTotal: verification.breakdown.discountSar,
      taxTotal: verification.breakdown.taxSar,
      totalBill: verification.breakdown.totalSar,
      currency: 'SAR',
      orderType: 'pickup',
      paymentStatus: 'pay_at_pickup',
      status: 'Pending',
      ...(pickupNotes ? { notes: pickupNotes } : {}),
      sourceApp: 'palm-metric-admin-stage04l',
      ...(req.lang ? { lang: req.lang } : {}),
      idempotencyKey: req.id,
      pricingVersion: AUTHORITATIVE_PRICING_VERSION,
      requestId: req.id,
      requestReference: req.requestReference,
      approvedBy: params.actor.uid,
      ...(params.actor.email ? { approvedByEmail: params.actor.email } : {}),
      approvedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };

    const auditEntries: OrderRequestAuditEntry[] = [];
    if (req.status !== 'verified') {
      auditEntries.push(
        buildAuditEntry({
          requestId: req.id,
          requestReference: req.requestReference,
          action: 'price_verified',
          actor: params.actor,
          fromStatus: req.status,
          toStatus: 'verified',
          note: `Authoritative total verified: ${verification.breakdown.totalSar} SAR`,
          verifiedTotalSar: verification.breakdown.totalSar,
          createdAtIso: nowIso,
          serverTs: ts,
        })
      );
    }
    auditEntries.push(
      buildAuditEntry({
        requestId: req.id,
        requestReference: req.requestReference,
        action: 'approve',
        actor: params.actor,
        fromStatus: req.status,
        toStatus: 'order_created',
        note: params.note,
        approvedOrderId: deterministicOrderId,
        approvedOrderNumber: orderNumber,
        verifiedTotalSar: verification.breakdown.totalSar,
        createdAtIso: nowIso,
        serverTs: ts,
      }),
      buildAuditEntry({
        requestId: req.id,
        requestReference: req.requestReference,
        action: 'order_promoted',
        actor: params.actor,
        fromStatus: req.status,
        toStatus: 'order_created',
        note: `Created official order #${orderNumber}`,
        approvedOrderId: deterministicOrderId,
        approvedOrderNumber: orderNumber,
        verifiedTotalSar: verification.breakdown.totalSar,
        createdAtIso: nowIso,
        serverTs: ts,
      })
    );

    const nextTrail = appendAuditSummary(req.auditTrail, auditEntries);

    tx.setOrder(deterministicOrderId, officialOrderPayload);
    tx.updateOrderRequest(req.id, {
      status: 'order_created',
      reviewStatus: 'approved',
      approvedOrderId: deterministicOrderId,
      approvedOrderNumber: orderNumber,
      approvedBy: params.actor.uid,
      ...(params.actor.email ? { approvedByEmail: params.actor.email } : {}),
      approvedAt: ts,
      verifiedPricing: verification.breakdown,
      verifiedItems: verification.verifiedItems,
      ...(req.verifiedBy
        ? {}
        : {
            verifiedBy: params.actor.uid,
            ...(params.actor.email ? { verifiedByEmail: params.actor.email } : {}),
            verifiedAt: ts,
          }),
      auditTrail: nextTrail,
      updatedAt: ts,
    });
    for (const entry of auditEntries) {
      tx.addAuditLog(req.id, entry);
    }

    const createdOrder: Order = {
      id: deterministicOrderId,
      orderNumber,
      customerUid: req.customerUid,
      customerName: req.customerName,
      customerContact: req.customerContact,
      items: canonicalOrderItems,
      subtotal: verification.breakdown.subtotalSar,
      discountTotal: verification.breakdown.discountSar,
      taxTotal: verification.breakdown.taxSar,
      totalBill: verification.breakdown.totalSar,
      currency: 'SAR',
      orderType: 'pickup',
      paymentStatus: 'pay_at_pickup',
      status: 'Pending',
      ...(pickupNotes ? { notes: pickupNotes } : {}),
      sourceApp: 'palm-metric-admin-stage04l',
      ...(req.lang ? { lang: req.lang } : {}),
      idempotencyKey: req.id,
      pricingVersion: AUTHORITATIVE_PRICING_VERSION,
      requestId: req.id,
      requestReference: req.requestReference,
      approvedBy: params.actor.uid,
      ...(params.actor.email ? { approvedByEmail: params.actor.email } : {}),
      createdAt: ts as Timestamp | null,
      updatedAt: ts as Timestamp | null,
    };

    const updatedRequest: OrderRequest = {
      ...req,
      status: 'order_created',
      reviewStatus: 'approved',
      approvedOrderId: deterministicOrderId,
      approvedOrderNumber: orderNumber,
      approvedBy: params.actor.uid,
      ...(params.actor.email ? { approvedByEmail: params.actor.email } : {}),
      verifiedPricing: verification.breakdown,
      verifiedItems: verification.verifiedItems,
      auditTrail: nextTrail,
    };

    return {
      idempotentReplay: false,
      order: createdOrder,
      request: updatedRequest,
      verification,
    };
  });
}

export async function rejectOrderRequest(params: {
  store: OrderRequestStore;
  requestId: string;
  actor: AdminActor;
  rejectionReason: string;
}): Promise<OrderRequest> {
  assertValidAdminActor(params.actor);
  const trimmedReason = (params.rejectionReason || '').trim();
  if (!trimmedReason) {
    throw new OrderWorkflowError(
      'REJECTION_REASON_REQUIRED',
      'A clear rejection reason is required before rejecting an order request.'
    );
  }
  const boundedReason = trimmedReason.slice(
    0,
    VALIDATION_LIMITS.orderRequest.rejectionReasonMaxLength
  );

  return params.store.runTransaction(async (tx) => {
    const req = await tx.getOrderRequest(params.requestId);
    if (!req) {
      throw new OrderWorkflowError(
        'REQUEST_NOT_FOUND',
        `Order request "${params.requestId}" was not found.`
      );
    }
    if (req.status === 'order_created') {
      throw new OrderWorkflowError(
        'INVALID_STATE_TRANSITION',
        'Order has already been created and cannot be rejected as a request.'
      );
    }
    if (req.status === 'rejected') {
      throw new OrderWorkflowError(
        'ALREADY_REJECTED',
        'Order request is already rejected.'
      );
    }

    const ts = tx.serverTimestamp();
    const nowIso = tx.nowIso();
    const auditEntry = buildAuditEntry({
      requestId: req.id,
      requestReference: req.requestReference,
      action: 'reject',
      actor: params.actor,
      fromStatus: req.status,
      toStatus: 'rejected',
      rejectionReason: boundedReason,
      createdAtIso: nowIso,
      serverTs: ts,
    });
    const nextTrail = appendAuditSummary(req.auditTrail, [auditEntry]);

    tx.updateOrderRequest(req.id, {
      status: 'rejected',
      reviewStatus: 'rejected',
      rejectionReason: boundedReason,
      rejectedBy: params.actor.uid,
      ...(params.actor.email ? { rejectedByEmail: params.actor.email } : {}),
      rejectedAt: ts,
      auditTrail: nextTrail,
      updatedAt: ts,
    });
    tx.addAuditLog(req.id, auditEntry);

    return {
      ...req,
      status: 'rejected',
      reviewStatus: 'rejected',
      rejectionReason: boundedReason,
      rejectedBy: params.actor.uid,
      ...(params.actor.email ? { rejectedByEmail: params.actor.email } : {}),
      auditTrail: nextTrail,
    };
  });
}

export function createFirestoreOrderRequestStore(
  firestore: Firestore,
  fallbackCategories: CategoryItem[] = []
): OrderRequestStore {
  return {
    async runTransaction<T>(fn: (tx: OrderRequestTransactionContext) => Promise<T>): Promise<T> {
      // Pre-load categories outside transaction if small static list, or query once before transaction
      let loadedCategories = fallbackCategories;
      try {
        const catSnap = await getDocs(collection(firestore, 'categories'));
        if (!catSnap.empty) {
          loadedCategories = catSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CategoryItem, 'id'>),
          }));
        }
      } catch {
        // Fallback cleanly to active in-memory categories
      }

      return runTransaction(firestore, async (fsTx) => {
        const ctx: OrderRequestTransactionContext = {
          async getOrderRequest(requestId) {
            const snap = await fsTx.get(doc(firestore, 'orderRequests', requestId));
            if (!snap.exists()) return null;
            return normalizeOrderRequest(snap.id, snap.data() as Record<string, unknown>);
          },
          async getOrder(orderId) {
            const snap = await fsTx.get(doc(firestore, 'orders', orderId));
            if (!snap.exists()) return null;
            return {
              id: snap.id,
              ...(snap.data() as Omit<Order, 'id'>),
            };
          },
          async getCatalogContext(itemIds) {
            const uniqueIds = Array.from(new Set(itemIds.filter(Boolean)));
            const [coffeeSnap, pricingSnap, menuSnaps, customSnaps] = await Promise.all([
              fsTx.get(doc(firestore, 'settings', 'coffeeOptions')),
              fsTx.get(doc(firestore, 'settings', 'pricing')).catch(() => null),
              Promise.all(uniqueIds.map((id) => fsTx.get(doc(firestore, 'menu', id)))),
              Promise.all(
                uniqueIds.map((id) => fsTx.get(doc(firestore, 'productCustomizations', id)))
              ),
            ]);

            const menuById = new Map<string, MenuItem>();
            menuSnaps.forEach((snap) => {
              if (snap.exists()) {
                menuById.set(snap.id, {
                  id: snap.id,
                  ...(snap.data() as Omit<MenuItem, 'id'>),
                });
              }
            });

            const customizationsByProductId = new Map<string, ProductCustomization>();
            customSnaps.forEach((snap) => {
              if (snap.exists()) {
                customizationsByProductId.set(
                  snap.id,
                  sanitizeFirestoreCustomization(snap.id, snap.data() as Record<string, unknown>)
                );
              }
            });

            const coffeeOptions: CoffeeOptionsSettings = coffeeSnap.exists()
              ? {
                  ...DEFAULT_COFFEE_OPTIONS,
                  ...(coffeeSnap.data() as Partial<CoffeeOptionsSettings>),
                }
              : DEFAULT_COFFEE_OPTIONS;

            const pricingConfig: PricingConfigSettings | null =
              pricingSnap && pricingSnap.exists()
                ? (pricingSnap.data() as PricingConfigSettings)
                : null;

            return {
              menuById,
              customizationsByProductId,
              categories: loadedCategories,
              coffeeOptions,
              pricingConfig,
            };
          },
          updateOrderRequest(requestId, patch) {
            fsTx.update(doc(firestore, 'orderRequests', requestId), patch);
          },
          setOrder(orderId, orderData) {
            fsTx.set(doc(firestore, 'orders', orderId), orderData);
          },
          addAuditLog(requestId, entry) {
            fsTx.set(
              doc(firestore, 'orderRequests', requestId, 'auditLogs', entry.id),
              entry
            );
          },
          serverTimestamp() {
            return serverTimestamp();
          },
          nowIso() {
            return new Date().toISOString();
          },
        };

        return fn(ctx);
      });
    },
  };
}

export function subscribeAdminOrderRequests(
  firestore: Firestore,
  onData: (requests: OrderRequest[]) => void,
  onError: (err: unknown) => void
): () => void {
  const q = query(collection(firestore, 'orderRequests'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        normalizeOrderRequest(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    onError
  );
}

export function subscribeCustomerOrderRequests(
  firestore: Firestore,
  customerUid: string,
  onData: (requests: OrderRequest[]) => void,
  onError: (err: unknown) => void
): () => void {
  const q = query(
    collection(firestore, 'orderRequests'),
    where('customerUid', '==', customerUid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        normalizeOrderRequest(d.id, d.data() as Record<string, unknown>)
      );
      onData(list);
    },
    onError
  );
}

export function subscribeOrderRequestAuditLogs(
  firestore: Firestore,
  requestId: string,
  onData: (logs: OrderRequestAuditEntry[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(
    collection(firestore, 'orderRequests', requestId, 'auditLogs'),
    orderBy('createdAtIso', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<OrderRequestAuditEntry, 'id'>),
      }));
      onData(list);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function createCustomerOrderRequest(
  firestore: Firestore,
  params: {
    customerUid: string;
    customerName: string;
    customerContact: string;
    items: OrderRequestItemInput[];
    notes?: string;
    pickupWindow?: string;
    clientEstimatedTotal?: number;
    lang?: 'ar' | 'en';
    sourceApp?: string;
  }
): Promise<{ requestId: string; requestReference: string }> {
  const requestRefDoc = doc(collection(firestore, 'orderRequests'));
  const requestId = requestRefDoc.id;
  const requestReference = generateRequestReference();
  const nowIso = new Date().toISOString();
  const ts = serverTimestamp();

  const initialAudit: OrderRequestAuditEntry = {
    id: `audit_${Date.now()}_submitted`,
    requestId,
    requestReference,
    action: 'submitted',
    actorUid: params.customerUid,
    actorRole: 'customer',
    toStatus: 'pending_review',
    note: 'Customer submitted order request for admin review',
    createdAtIso: nowIso,
  };

  await setDoc(requestRefDoc, {
    requestReference,
    customerUid: params.customerUid,
    customerName: params.customerName,
    customerContact: params.customerContact,
    pickupType: 'pickup',
    ...(params.pickupWindow ? { pickupWindow: params.pickupWindow } : {}),
    items: params.items,
    ...(params.notes ? { notes: params.notes } : {}),
    status: 'pending_review',
    reviewStatus: 'unreviewed',
    sourceApp: params.sourceApp || 'palm-metric-customer-preview',
    ...(params.lang ? { lang: params.lang } : {}),
    ...(typeof params.clientEstimatedTotal === 'number'
      ? { clientEstimatedTotal: Number(params.clientEstimatedTotal.toFixed(2)) }
      : {}),
    auditTrail: [initialAudit],
    createdAt: ts,
    updatedAt: ts,
  });

  return { requestId, requestReference };
}
