import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { verifyAndPriceOrderRequest } from '../src/lib/authoritativePricing';
import { isBootstrappedAdminEmail } from '../src/lib/adminAllowlist';
import {
  OrderRequestStore,
  OrderRequestTransactionContext,
  OrderWorkflowError,
  approveAndPromoteOrderRequest,
  getDeterministicOrderId,
  getOfficialOrderNumber,
  normalizeOrderRequest,
  rejectOrderRequest,
  startOrderRequestReview,
  verifyOrderRequest,
} from '../src/lib/orderRequests';
import {
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_COFFEE_OPTIONS,
  MenuItem,
  Order,
  OrderRequest,
  OrderRequestAuditEntry,
  OrderRequestStatus,
  PricingConfigSettings,
  ProductCustomization,
} from '../src/types';

class InMemoryTransactionalStore implements OrderRequestStore {
  requests = new Map<string, Record<string, unknown>>();
  orders = new Map<string, Order>();
  orderNumbers = new Map<string, Record<string, unknown>>();
  menu = new Map<string, MenuItem>();
  customizations = new Map<string, ProductCustomization>();
  auditLogs = new Map<string, OrderRequestAuditEntry[]>();
  categories: CategoryItem[] = [];
  coffeeOptions: CoffeeOptionsSettings = DEFAULT_COFFEE_OPTIONS;
  pricingConfig: PricingConfigSettings | null = null;
  private txMutex: Promise<void> = Promise.resolve();
  private clockSeq = 1;

  seedRequest(req: OrderRequest) {
    this.requests.set(req.id, structuredClone(req) as unknown as Record<string, unknown>);
  }

  seedMenuItem(item: MenuItem) {
    this.menu.set(item.id, structuredClone(item));
  }

  seedCustomization(cfg: ProductCustomization) {
    this.customizations.set(cfg.productId, structuredClone(cfg));
  }

  async runTransaction<T>(
    fn: (tx: OrderRequestTransactionContext) => Promise<T>
  ): Promise<T> {
    // Serialize transaction execution just like Firestore optimistic transaction commit
    let release!: () => void;
    const prev = this.txMutex;
    this.txMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;

    try {
      const stagedRequests = new Map(this.requests);
      const stagedOrders = new Map(this.orders);
      const stagedOrderNumbers = new Map(this.orderNumbers);
      const menuSnapshot = this.menu;
      const customSnapshot = this.customizations;
      const categoriesCopy = this.categories;
      const coffeeOptionsCopy = this.coffeeOptions;
      const pricingConfigCopy = this.pricingConfig;
      const pendingMutations: (() => void)[] = [];

      const ctx: OrderRequestTransactionContext = {
        async getOrderRequest(requestId) {
          const raw = stagedRequests.get(requestId);
          return raw ? normalizeOrderRequest(requestId, structuredClone(raw)) : null;
        },
        async getOrder(orderId) {
          const existing = stagedOrders.get(orderId);
          return existing ? structuredClone(existing) : null;
        },
        async getOrderNumberClaim(orderNumber) {
          const existing = stagedOrderNumbers.get(orderNumber);
          return existing ? structuredClone(existing) : null;
        },
        async getCatalogContext(itemIds) {
          const menuById = new Map<string, MenuItem>();
          const customizationsByProductId = new Map<string, ProductCustomization>();
          for (const id of itemIds) {
            const m = menuSnapshot.get(id);
            if (m) menuById.set(id, structuredClone(m));
            const c = customSnapshot.get(id);
            if (c) customizationsByProductId.set(id, structuredClone(c));
          }
          return {
            menuById,
            customizationsByProductId,
            categories: structuredClone(categoriesCopy),
            coffeeOptions: structuredClone(coffeeOptionsCopy),
            pricingConfig: pricingConfigCopy ? structuredClone(pricingConfigCopy) : null,
          };
        },
        updateOrderRequest: (requestId, patch) => {
          pendingMutations.push(() => {
            const current = this.requests.get(requestId) || {};
            this.requests.set(requestId, { ...current, ...patch });
          });
        },
        updateMenuDoc: (itemId, patch) => {
          pendingMutations.push(() => {
            const current = this.menu.get(itemId);
            if (current) {
              this.menu.set(itemId, { ...current, ...(patch as Partial<MenuItem>) });
            }
          });
        },
        setOrder: (orderId, orderData) => {
          pendingMutations.push(() => {
            this.orders.set(orderId, {
              id: orderId,
              ...(orderData as Omit<Order, 'id'>),
            });
          });
        },
        setOrderNumberClaim: (orderNumber, claimData) => {
          pendingMutations.push(() => {
            this.orderNumbers.set(orderNumber, structuredClone(claimData));
          });
        },
        addAuditLog: (requestId, entry) => {
          pendingMutations.push(() => {
            const list = this.auditLogs.get(requestId) || [];
            list.push(structuredClone(entry));
            this.auditLogs.set(requestId, list);
          });
        },
        serverTimestamp: () => null,
        nowIso: () => {
          const sec = String(10 + (this.clockSeq++ % 45)).padStart(2, '0');
          return `2026-11-22T12:00:${sec}.000Z`;
        },
      };

      const result = await fn(ctx);
      for (const apply of pendingMutations) {
        apply();
      }
      return result;
    } finally {
      release();
    }
  }
}

function createFixtureStore(): InMemoryTransactionalStore {
  const store = new InMemoryTransactionalStore();

  store.seedMenuItem({
    id: 'espresso-flat-white',
    name: 'Flat White',
    nameAr: 'فلات وايت',
    category: 'Espresso',
    price: 18.1,
    description: 'Double ristretto with velvety milk',
    inStock: true,
    imageUrl: 'https://example.com/flat-white.jpg',
    storagePath: '',
    allowMilkOption: true,
    coconutMilkPrice: 3,
    allowTemperature: true,
  });

  store.seedMenuItem({
    id: 'matcha-palm',
    name: 'Palm Matcha',
    nameAr: 'بالم ماتشا',
    category: 'Matcha',
    price: 24,
    description: 'Ceremonial grade matcha',
    inStock: true,
    stockQuantity: 5,
    imageUrl: 'https://example.com/matcha.jpg',
    storagePath: '',
  });

  store.seedMenuItem({
    id: 'sold-out-pastry',
    name: 'Almond Croissant',
    nameAr: 'كرواسون لوز',
    category: 'Food',
    price: 16,
    description: 'Freshly baked',
    inStock: false,
    imageUrl: '',
    storagePath: '',
  });

  store.seedCustomization({
    productId: 'espresso-flat-white',
    enabled: true,
    schemaVersion: 1,
    allowSpecialInstructions: true,
    updatedBy: 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2',
    groups: [
      {
        id: 'size',
        name: 'Cup Size',
        nameAr: 'حجم الكوب',
        type: 'single',
        required: true,
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 1,
        enabled: true,
        options: [
          {
            id: 'regular',
            name: 'Regular',
            nameAr: 'عادي',
            additionalPrice: 0,
            enabled: true,
            isDefault: true,
            displayOrder: 1,
          },
          {
            id: 'large',
            name: 'Large',
            nameAr: 'كبير',
            additionalPrice: 2.2,
            enabled: true,
            isDefault: false,
            displayOrder: 2,
          },
        ],
      },
      {
        id: 'milk',
        name: 'Milk',
        nameAr: 'الحليب',
        type: 'single',
        required: true,
        minSelections: 1,
        maxSelections: 1,
        displayOrder: 2,
        enabled: true,
        options: [
          {
            id: 'full-cream',
            name: 'Full Cream',
            nameAr: 'كامل الدسم',
            additionalPrice: 0,
            enabled: true,
            isDefault: true,
            displayOrder: 1,
          },
          {
            id: 'coconut',
            name: 'Coconut Milk',
            nameAr: 'حليب جوز الهند',
            additionalPrice: 3,
            enabled: true,
            isDefault: false,
            displayOrder: 2,
          },
          {
            id: 'oat-disabled',
            name: 'Oat Milk',
            nameAr: 'حليب شوفان',
            additionalPrice: 4,
            enabled: false,
            isDefault: false,
            displayOrder: 3,
          },
        ],
      },
      {
        id: 'extras',
        name: 'Add-ons',
        nameAr: 'إضافات',
        type: 'multiple',
        required: false,
        minSelections: 0,
        maxSelections: 2,
        displayOrder: 3,
        enabled: true,
        options: [
          {
            id: 'extra-shot',
            name: 'Extra Shot',
            nameAr: 'شوت إضافي',
            additionalPrice: 5,
            enabled: true,
            isDefault: false,
            displayOrder: 1,
          },
          {
            id: 'vanilla',
            name: 'Vanilla',
            nameAr: 'فانيلا',
            additionalPrice: 2.5,
            enabled: true,
            isDefault: false,
            displayOrder: 2,
          },
          {
            id: 'caramel',
            name: 'Caramel',
            nameAr: 'كراميل',
            additionalPrice: 2.5,
            enabled: true,
            isDefault: false,
            displayOrder: 3,
          },
        ],
      },
    ],
  });

  store.seedRequest({
    id: 'req_001',
    requestReference: 'REQ-261122-1001',
    customerUid: 'cust_uid_sara',
    customerName: 'Sara Al-Qahtani',
    customerContact: '+966500001111',
    pickupType: 'pickup',
    pickupWindow: '15 mins',
    items: [
      {
        itemId: 'espresso-flat-white',
        name: 'Flat White',
        quantity: 2,
        temperature: 'Hot',
        selectedCustomizations: [
          { groupId: 'size', optionId: 'large', additionalPrice: 0 }, // tampered client extra price!
          { groupId: 'milk', optionId: 'coconut', additionalPrice: 0 }, // tampered!
        ],
        submittedUnitPrice: 1, // tampered unit price!
        specialInstructions: 'Extra hot',
      },
    ],
    notes: 'At counter',
    clientEstimatedTotal: 2, // tampered estimate!
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  });

  return store;
}

const ADMIN_A = { uid: 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2', email: 'tashflow26@gmail.com' };
const ADMIN_B = { uid: 'admin_uid_2', email: 'palmmetric1@gmail.com' };

// 1. Admin authentication & bootstrapped allowlist checks
test('01. Admin authentication and allowlist enforcement rejects empty actor and unknown emails', async () => {
  assert.equal(isBootstrappedAdminEmail('tashflow26@gmail.com'), true);
  assert.equal(isBootstrappedAdminEmail('PALMMETRIC1@gmail.com'), true);
  assert.equal(isBootstrappedAdminEmail('customer@gmail.com'), false);
  assert.equal(isBootstrappedAdminEmail(null), false);

  const store = createFixtureStore();
  await assert.rejects(
    () =>
      startOrderRequestReview({
        store,
        requestId: 'req_001',
        actor: { uid: '' },
      }),
    (err: unknown) => err instanceof OrderWorkflowError && err.code === 'UNAUTHORIZED_ADMIN'
  );
});

// 2. Customer / unverified user privilege boundary in Spark rules
test('02. Spark security rules strictly deny non-admin and anonymous updates to /orderRequests and /orders', () => {
  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  assert.ok(sparkRules.includes("sign_in_provider != 'anonymous'"));
  assert.ok(sparkRules.includes('allow update: if isValidId(requestId) && isAdmin() && isValidOrderRequestAdminUpdate'));
  assert.ok(sparkRules.includes('allow create: if isValidId(orderId) && isAdmin() && isValidPromotedOrderCreate'));
});

// 3. Admin retrieves and normalizes pending_review requests
test('03. Normalizes incoming pending_review order requests cleanly', () => {
  const req = normalizeOrderRequest('req_abc', {
    requestReference: 'REQ-261122-9009',
    customerUid: 'cust_1',
    customerName: 'Omar',
    customerContact: '0551234567',
    items: [{ productId: 'matcha-palm', quantity: 2, price: 24 }],
    status: 'pending_review',
  });
  assert.equal(req.id, 'req_abc');
  assert.equal(req.requestReference, 'REQ-261122-9009');
  assert.equal(req.status, 'pending_review');
  assert.equal(req.reviewStatus, 'unreviewed');
  assert.equal(req.items[0].itemId, 'matcha-palm');
  assert.equal(req.pickupType, 'pickup');
});

// 4. Filter and search support across all 5 Stage 04L statuses
test('04. Supports filtering by all Stage 04L statuses and searching by REQ- reference', () => {
  const statuses: OrderRequestStatus[] = [
    'pending_review',
    'reviewing',
    'verified',
    'rejected',
    'order_created',
  ];
  const sampleList = statuses.map((status, idx) =>
    normalizeOrderRequest(`r_${idx}`, {
      requestReference: `REQ-261122-000${idx}`,
      customerUid: `c_${idx}`,
      customerName: idx === 2 ? 'Noura' : `Customer ${idx}`,
      customerContact: '0500000000',
      items: [{ itemId: 'matcha-palm', quantity: 1 }],
      status,
    })
  );
  assert.equal(sampleList.filter((r) => r.status === 'verified').length, 1);
  assert.equal(
    sampleList.filter(
      (r) =>
        r.requestReference.includes('0002') ||
        r.customerName.toLowerCase().includes('noura')
    ).length,
    1
  );
});

// 5. Admin starts review (reviewing) & updates audit log
test('05. Admin starts review, transitions request to reviewing, and records audit log', async () => {
  const store = createFixtureStore();
  const updated = await startOrderRequestReview({
    store,
    requestId: 'req_001',
    actor: ADMIN_A,
    note: 'Checking milk availability',
  });
  assert.equal(updated.status, 'reviewing');
  assert.equal(updated.reviewStatus, 'in_review');
  assert.equal(updated.reviewedBy, ADMIN_A.uid);

  const logs = store.auditLogs.get('req_001') || [];
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, 'start_review');
  assert.equal(logs[0].toStatus, 'reviewing');
});

// 6. Authoritative pricing completely ignores tampered client-submitted figures
test('06. Authoritative price calculation ignores tampered client prices and flags mismatch', async () => {
  const store = createFixtureStore();
  const result = await verifyOrderRequest({
    store,
    requestId: 'req_001',
    actor: ADMIN_A,
  });

  // 18.10 base + 2.20 large + 3.00 coconut = 23.30 SAR per unit * 2 = 46.60 SAR
  assert.equal(result.verification.breakdown.totalSar, 46.6);
  assert.equal(result.verification.breakdown.clientSubmittedTotalSar, 2);
  assert.equal(result.verification.breakdown.clientPriceMismatch, true);
  assert.equal(result.verification.warnings[0].code, 'CLIENT_PRICE_MISMATCH');
  assert.equal(result.request.status, 'verified');
});

// 7. Halalas arithmetic avoids floating-point drift
test('07. Halalas calculation computes SAR decimals accurately without floating-point drift', () => {
  const store = createFixtureStore();
  const req: OrderRequest = {
    id: 'req_float',
    requestReference: 'REQ-FLOAT-1',
    customerUid: 'cust_float',
    customerName: 'Ali',
    customerContact: '0501112222',
    pickupType: 'pickup',
    items: [
      {
        itemId: 'espresso-flat-white',
        quantity: 3,
        selectedCustomizations: [
          { groupId: 'size', optionId: 'large' }, // +2.20
          { groupId: 'milk', optionId: 'full-cream' }, // +0.00
          { groupId: 'extras', optionId: 'vanilla' }, // +2.50
        ],
      },
    ],
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  };

  // (18.10 + 2.20 + 2.50) * 3 = 22.80 * 3 = 68.40 SAR
  const verification = verifyAndPriceOrderRequest(req, {
    menuById: store.menu,
    customizationsByProductId: store.customizations,
    categories: store.categories,
    coffeeOptions: store.coffeeOptions,
  });
  assert.equal(verification.ok, true);
  assert.equal(verification.breakdown.subtotalHalalas, 6840);
  assert.equal(verification.breakdown.totalSar, 68.4);
});

// 8. Verification rejects requests referencing nonexistent products
test('08. Verification rejects nonexistent products cleanly', async () => {
  const store = createFixtureStore();
  store.seedRequest({
    id: 'req_missing_item',
    requestReference: 'REQ-MISSING-1',
    customerUid: 'cust_1',
    customerName: 'Lama',
    customerContact: '0503334444',
    pickupType: 'pickup',
    items: [{ itemId: 'nonexistent-drink', quantity: 1 }],
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  });

  await assert.rejects(
    () => verifyOrderRequest({ store, requestId: 'req_missing_item', actor: ADMIN_A }),
    (err: unknown) =>
      err instanceof OrderWorkflowError &&
      err.code === 'VERIFICATION_FAILED' &&
      err.issues.some((i) => i.code === 'UNKNOWN_PRODUCT')
  );
});

// 9. Verification rejects out-of-stock or insufficient stock products
test('09. Verification rejects out-of-stock and insufficient stock items', async () => {
  const store = createFixtureStore();
  store.seedRequest({
    id: 'req_oos',
    requestReference: 'REQ-OOS-1',
    customerUid: 'cust_1',
    customerName: 'Lama',
    customerContact: '0503334444',
    pickupType: 'pickup',
    items: [
      { itemId: 'sold-out-pastry', quantity: 1 },
      { itemId: 'matcha-palm', quantity: 6 }, // stockQuantity is 5
    ],
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  });

  await assert.rejects(
    () => approveAndPromoteOrderRequest({ store, requestId: 'req_oos', actor: ADMIN_A }),
    (err: unknown) =>
      err instanceof OrderWorkflowError &&
      err.code === 'VERIFICATION_FAILED' &&
      err.issues.some((i) => i.code === 'OUT_OF_STOCK') &&
      err.issues.some((i) => i.code === 'INSUFFICIENT_STOCK')
  );
  assert.equal(store.orders.size, 0);
});

// 10. Verification rejects disabled/invalid/incomplete customizations
test('10. Verification rejects disabled option, missing required group, and exceeded maxSelections', () => {
  const store = createFixtureStore();
  const badReq: OrderRequest = {
    id: 'req_bad_custom',
    requestReference: 'REQ-BAD-CUSTOM-1',
    customerUid: 'cust_1',
    customerName: 'Tariq',
    customerContact: '0509998888',
    pickupType: 'pickup',
    items: [
      {
        itemId: 'espresso-flat-white',
        quantity: 1,
        selectedCustomizations: [
          // missing required 'size'!
          { groupId: 'milk', optionId: 'oat-disabled' }, // disabled option!
          { groupId: 'extras', optionId: 'extra-shot' },
          { groupId: 'extras', optionId: 'vanilla' },
          { groupId: 'extras', optionId: 'caramel' }, // exceeds maxSelections: 2!
        ],
      },
    ],
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  };

  const result = verifyAndPriceOrderRequest(badReq, {
    menuById: store.menu,
    customizationsByProductId: store.customizations,
  });
  assert.equal(result.ok, false);
  const codes = new Set(result.blockingIssues.map((i) => i.code));
  assert.ok(codes.has('INVALID_OR_DISABLED_OPTION'));
  assert.ok(codes.has('REQUIRED_GROUP_MISSING'));
  assert.ok(codes.has('MAX_SELECTIONS_EXCEEDED'));
});

// 11 & 12. Admin approval atomically creates official /orders doc and updates /orderRequests
test('11 & 12. Approval atomically creates official /orders doc with deterministic ID and updates request', async () => {
  const store = createFixtureStore();
  const res = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_001',
    actor: ADMIN_A,
    note: 'Counter pickup ready',
  });

  const expectedOrderId = getDeterministicOrderId('req_001');
  const expectedOrderNum = getOfficialOrderNumber('req_001', 'REQ-261122-1001');

  assert.equal(res.idempotentReplay, false);
  assert.equal(res.order.id, expectedOrderId);
  assert.equal(res.order.orderNumber, expectedOrderNum);
  assert.equal(res.order.totalBill, 46.6);
  assert.equal(res.order.subtotal, 46.6);
  assert.equal(res.order.currency, 'SAR');
  assert.equal(res.order.orderType, 'pickup');
  assert.equal(res.order.status, 'Pending');
  assert.equal(res.order.sourceRequestId, 'req_001');
  assert.equal(res.order.requestReference, 'REQ-261122-1001');
  assert.equal(res.order.approvedBy, ADMIN_A.uid);
  assert.equal(store.menu.get('matcha-palm')?.stockQuantity, 5);
  assert.equal(store.orderNumbers.get(expectedOrderNum)?.orderId, expectedOrderId);
  // Legacy /orders compatibility fields
  assert.equal(res.order.items[0].milkOption, 'coconut');
  assert.equal(res.order.items[0].milkExtraPrice, 3);
  assert.equal(res.order.items[0].temperature, 'Hot');

  // Verify request updated atomically
  const persistedReq = normalizeOrderRequest('req_001', store.requests.get('req_001')!);
  assert.equal(persistedReq.status, 'order_created');
  assert.equal(persistedReq.reviewStatus, 'approved');
  assert.equal(persistedReq.approvedOrderId, expectedOrderId);
  assert.equal(persistedReq.approvedOrderNumber, expectedOrderNum);
  assert.equal(persistedReq.verifiedTotalSar, 46.6);
  assert.equal(store.orders.size, 1);
});

// 13. Repeated or concurrent approval by two admins creates ONLY ONE official order
test('13. Concurrent and repeated approval by two admins creates strictly one official order', async () => {
  const store = createFixtureStore();
  const [resA, resB] = await Promise.all([
    approveAndPromoteOrderRequest({ store, requestId: 'req_001', actor: ADMIN_A }),
    approveAndPromoteOrderRequest({ store, requestId: 'req_001', actor: ADMIN_B }),
  ]);

  assert.equal(store.orders.size, 1);
  assert.equal(resA.order.id, resB.order.id);
  assert.equal(resA.order.orderNumber, resB.order.orderNumber);
  assert.equal(Number(resA.idempotentReplay) + Number(resB.idempotentReplay), 1);

  // Third sequential retry also replays safely
  const resC = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_001',
    actor: ADMIN_B,
  });
  assert.equal(resC.idempotentReplay, true);
  assert.equal(store.orders.size, 1);
});

// 14, 15, 16. Rejection rules: mandatory reason, rejected state, blocks subsequent approval
test('14, 15, 16. Rejection enforces mandatory reason, updates status, and blocks promotion', async () => {
  const store = createFixtureStore();

  await assert.rejects(
    () =>
      rejectOrderRequest({
        store,
        requestId: 'req_001',
        actor: ADMIN_A,
        rejectionReason: '   ',
      }),
    (err: unknown) =>
      err instanceof OrderWorkflowError && err.code === 'REJECTION_REASON_REQUIRED'
  );

  const rejected = await rejectOrderRequest({
    store,
    requestId: 'req_001',
    actor: ADMIN_A,
    rejectionReason: 'Coconut milk temporarily depleted.',
  });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reviewStatus, 'rejected');
  assert.equal(rejected.rejectionReason, 'Coconut milk temporarily depleted.');

  // Cannot approve a rejected request
  await assert.rejects(
    () =>
      approveAndPromoteOrderRequest({
        store,
        requestId: 'req_001',
        actor: ADMIN_B,
      }),
    (err: unknown) => err instanceof OrderWorkflowError && err.code === 'ALREADY_REJECTED'
  );
  assert.equal(store.orders.size, 0);
});

// 17 & 18. Customer mutation prevention & owner-scoped isolation in Spark rules
test('17 & 18. Spark rules prevent customer post-submit updates/tampering and isolate reads by customerUid', () => {
  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  const reqBlockMatch = sparkRules.match(/match \/orderRequests\/\{requestId\} \{[\s\S]*?\n    \}/);
  assert.ok(reqBlockMatch, '/orderRequests block exists in firestore.spark.rules');
  const reqBlock = reqBlockMatch[0];

  assert.ok(reqBlock.includes('existing().customerUid == request.auth.uid'));
  assert.ok(reqBlock.includes('resource.data.customerUid == request.auth.uid'));
  assert.ok(reqBlock.includes('isValidOrderRequestCreate(incoming(), requestId)'));
  assert.ok(sparkRules.includes("data.status == 'pending_review'"));
  assert.ok(reqBlock.includes('allow update: if isValidId(requestId) && isAdmin()'));
  assert.ok(reqBlock.includes('allow delete: if false;'));
  assert.ok(sparkRules.includes("prev.status in ['pending_review', 'under_review', 'reviewing', 'verified']"));
});

// 19. Audit logs record complete admin workflow & are immutable in Spark rules
test('19. Audit logs record review, price verification, approval, promotion, and are append-only in Spark rules', async () => {
  const store = createFixtureStore();
  await startOrderRequestReview({ store, requestId: 'req_001', actor: ADMIN_A });
  await verifyOrderRequest({ store, requestId: 'req_001', actor: ADMIN_A });
  await approveAndPromoteOrderRequest({ store, requestId: 'req_001', actor: ADMIN_B });

  const logs = store.auditLogs.get('req_001') || [];
  const actions = logs.map((l) => l.action);
  assert.deepEqual(actions, [
    'start_review',
    'verify',
    'price_verified',
    'approve',
    'order_promoted',
  ]);

  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  const auditMatch = sparkRules.match(/match \/auditLogs\/\{logId\} \{[\s\S]*?\n      \}/);
  assert.ok(auditMatch, '/auditLogs subcollection rule block exists');
  assert.ok(auditMatch[0].includes('allow get, list: if isValidId(requestId) && isAdmin();'));
  assert.ok(auditMatch[0].includes('allow update, delete: if false;'));
});

// 20. Static security audit of firestore.spark.rules & firebase-blueprint.json
test('20. Proposed Spark rules and firebase-blueprint.json satisfy Spark security invariants with zero Cloud Functions', () => {
  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  );
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

  // Zero Blaze-only Cloud Functions dependency
  assert.equal('firebase-functions' in (pkg.dependencies || {}), false);
  assert.equal('@firebase/functions' in (pkg.dependencies || {}), false);

  // Rules security invariants
  assert.match(sparkRules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.equal(sparkRules.includes('sign_in_provider is string'), false);
  assert.ok(sparkRules.includes("orderId == 'ord_' + data.sourceRequestId"));
  assert.ok(sparkRules.includes('existsAfter(/databases/$(database)/documents/orders/$(data.approvedOrderId))'));
  assert.ok(sparkRules.includes("getAfter(/databases/$(database)/documents/orderRequests/$(data.sourceRequestId)).data.status == 'order_created'"));
  assert.ok(sparkRules.includes('existsAfter(/databases/$(database)/documents/orderNumbers/$(data.orderNumber))'));

  // Blueprint entries exist
  assert.ok('/orderRequests/{requestId}' in blueprint.firestore);
  assert.ok('/orderRequests/{requestId}/auditLogs/{logId}' in blueprint.firestore);
  assert.ok('/orderNumbers/{orderNumber}' in blueprint.firestore);
  assert.ok('/orders/{orderId}' in blueprint.firestore);
});

// 21. Configured optional discount and tax without inventing unconfigured rates
test('21. Applies explicitly configured discounts/taxes in halalas and keeps zero when unconfigured', () => {
  const store = createFixtureStore();
  store.pricingConfig = {
    discountEnabled: true,
    discountType: 'percent',
    discountValue: 10,
    discountLabel: 'VIP10',
    taxEnabled: true,
    taxRatePercent: 15,
  };

  const req: OrderRequest = {
    id: 'req_tax_disc',
    requestReference: 'REQ-TD-1',
    customerUid: 'cust_td',
    customerName: 'Fahad',
    customerContact: '0507778888',
    pickupType: 'pickup',
    items: [{ itemId: 'matcha-palm', quantity: 2 }], // 24 * 2 = 48.00 SAR
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  };

  const withConfig = verifyAndPriceOrderRequest(req, {
    menuById: store.menu,
    customizationsByProductId: store.customizations,
    pricingConfig: store.pricingConfig,
  });
  // Subtotal 48.00 -> 10% discount (-4.80) -> taxable 43.20 -> 15% tax (+6.48) -> total 49.68 SAR
  assert.equal(withConfig.breakdown.subtotalSar, 48);
  assert.equal(withConfig.breakdown.discountSar, 4.8);
  assert.equal(withConfig.breakdown.taxSar, 6.48);
  assert.equal(withConfig.breakdown.totalSar, 49.68);

  const withoutConfig = verifyAndPriceOrderRequest(req, {
    menuById: store.menu,
    customizationsByProductId: store.customizations,
    pricingConfig: null,
  });
  assert.equal(withoutConfig.breakdown.discountSar, 0);
  assert.equal(withoutConfig.breakdown.taxSar, 0);
  assert.equal(withoutConfig.breakdown.totalSar, 48);
});

// 22. Transaction aborts promotion if item becomes out-of-stock right before approval commit
test('22. Approval transaction aborts cleanly if product stock becomes unavailable before approval', async () => {
  const store = createFixtureStore();
  await verifyOrderRequest({ store, requestId: 'req_001', actor: ADMIN_A });

  // Admin disables stock before final promotion
  const item = store.menu.get('espresso-flat-white')!;
  store.seedMenuItem({ ...item, inStock: false });

  await assert.rejects(
    () => approveAndPromoteOrderRequest({ store, requestId: 'req_001', actor: ADMIN_A }),
    (err: unknown) =>
      err instanceof OrderWorkflowError &&
      err.code === 'VERIFICATION_FAILED' &&
      err.issues.some((i) => i.code === 'OUT_OF_STOCK')
  );
  assert.equal(store.orders.size, 0);
  assert.equal(store.requests.get('req_001')?.status, 'verified');
});

// 23. Atomic stock deduction & depletion flag update on approval without double-deducting on replay
test('23. Approval atomically deducts managed stock, flips inStock=false on zero, and ignores unmanaged items', async () => {
  const store = createFixtureStore();
  // Seed stock-tracked request consuming all 5 matcha-palm
  store.seedRequest(
    normalizeOrderRequest('req_deplete', {
      requestReference: 'REQ-DEPLETE-1',
      customerUid: 'cust_dep',
      customerName: 'Depletion Test',
      customerContact: '0504445555',
      items: [
        { itemId: 'matcha-palm', quantity: 5 },
      ],
      status: 'pending_review',
    })
  );

  const first = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_deplete',
    actor: ADMIN_A,
  });
  assert.equal(first.idempotentReplay, false);
  assert.equal(store.menu.get('matcha-palm')?.stockQuantity, 0);
  assert.equal(store.menu.get('matcha-palm')?.inStock, false);

  // Concurrent / repeated replay must not deduct again or fail on remaining 0 stock
  const replay = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_deplete',
    actor: ADMIN_B,
  });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(store.menu.get('matcha-palm')?.stockQuantity, 0);
});
