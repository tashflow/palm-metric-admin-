import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  BOOTSTRAPPED_ADMIN_UIDS,
  isBootstrappedAdminEmail,
} from '../src/lib/adminAllowlist';
import { verifyAndPriceOrderRequest } from '../src/lib/authoritativePricing';
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

class Stage04MMockStore implements OrderRequestStore {
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
        nowIso: () => new Date().toISOString(),
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

function createStage04MMockStore(): Stage04MMockStore {
  const store = new Stage04MMockStore();
  store.seedMenuItem({
    id: 'spanish-latte-04m',
    name: 'Spanish Latte',
    nameAr: 'سبانيش لاتيه',
    category: 'Espresso',
    price: 21.5,
    description: 'Signature iced Spanish latte',
    inStock: true,
    stockQuantity: 10,
    imageUrl: '',
    storagePath: '',
  });

  store.seedRequest({
    id: 'req_04m_1',
    requestReference: 'REQ-261122-8888',
    customerUid: 'cust_04m',
    customerName: 'Nasser Al-Hajri',
    customerContact: '+966501234567',
    pickupType: 'pickup',
    pickupWindow: '20 mins',
    items: [
      {
        itemId: 'spanish-latte-04m',
        quantity: 2,
        submittedUnitPrice: 5, // tampered client price
        submittedLineTotal: 10,
      },
    ],
    notes: 'Please pack carefully',
    clientEstimatedTotal: 10,
    status: 'pending_review',
    reviewStatus: 'unreviewed',
  });

  return store;
}

const ADMIN = { uid: 'jPgFPc8KbsXaPrdkyrbCQSFDMOP2', email: 'tashflow26@gmail.com' };

test('01. Stage 04M Firebase project & database configuration consistency check', () => {
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  );
  assert.ok(blueprint.firestore, 'Blueprint has firestore entities');
  assert.ok('/orderRequests/{requestId}' in blueprint.firestore);
  assert.ok('/orders/{orderId}' in blueprint.firestore);
  assert.equal(isBootstrappedAdminEmail('tashflow26@gmail.com'), true);
  assert.equal(isBootstrappedAdminEmail('palmmetric1@gmail.com'), true);
});

test('02. Stage 04M Customer request normalization and Admin request parsing', () => {
  const raw = {
    requestReference: 'REQ-261122-7777',
    customerUid: 'cust_x',
    customerName: 'Reem',
    customerContact: '0501112222',
    items: [{ productId: 'spanish-latte-04m', quantity: 1, price: 21.5 }],
    status: 'pending_review',
  };
  const normalized = normalizeOrderRequest('req_test_norm', raw);
  assert.equal(normalized.id, 'req_test_norm');
  assert.equal(normalized.requestReference, 'REQ-261122-7777');
  assert.equal(normalized.customerName, 'Reem');
  assert.equal(normalized.items[0].itemId, 'spanish-latte-04m');
  assert.equal(normalized.status, 'pending_review');
});

test('03. Stage 04M Authoritative pricing ignores client-submitted price and computes correct SAR total', async () => {
  const store = createStage04MMockStore();
  const res = await verifyOrderRequest({
    store,
    requestId: 'req_04m_1',
    actor: ADMIN,
  });
  // 21.50 * 2 = 43.00 SAR
  assert.equal(res.verification.breakdown.totalSar, 43);
  assert.equal(res.verification.breakdown.clientPriceMismatch, true);
  assert.equal(res.request.status, 'verified');
});

test('04. Stage 04M Atomic Admin approval, promotion, and unique official order ID creation', async () => {
  const store = createStage04MMockStore();
  const promo = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_04m_1',
    actor: ADMIN,
    note: 'Approved for pickup',
  });

  const expectedOrderId = getDeterministicOrderId('req_04m_1');
  const expectedOrderNum = getOfficialOrderNumber('req_04m_1', 'REQ-261122-8888');

  assert.equal(promo.idempotentReplay, false);
  assert.equal(promo.order.id, expectedOrderId);
  assert.equal(promo.order.orderNumber, expectedOrderNum);
  assert.equal(promo.order.totalBill, 43);
  assert.equal(promo.request.status, 'order_created');
  assert.equal(store.orders.size, 1);
});

test('05. Stage 04M Idempotent replay prevents duplicate official orders on repeated approval', async () => {
  const store = createStage04MMockStore();
  const first = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_04m_1',
    actor: ADMIN,
  });
  const second = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_04m_1',
    actor: ADMIN,
  });

  assert.equal(first.idempotentReplay, false);
  assert.equal(second.idempotentReplay, true);
  assert.equal(store.orders.size, 1);
  assert.equal(first.order.id, second.order.id);
});

test('06. Stage 04M Rejection workflow enforces mandatory reason and blocks promotion', async () => {
  const store = createStage04MMockStore();
  const rejected = await rejectOrderRequest({
    store,
    requestId: 'req_04m_1',
    actor: ADMIN,
    rejectionReason: 'Store closing early today.',
  });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejectionReason, 'Store closing early today.');

  await assert.rejects(
    () => approveAndPromoteOrderRequest({ store, requestId: 'req_04m_1', actor: ADMIN }),
    (err: unknown) => err instanceof OrderWorkflowError && err.code === 'ALREADY_REJECTED'
  );
});

test('07. Stage 04M Inventory & stock depletion validation blocks promotion when stock is insufficient', async () => {
  const store = createStage04MMockStore();
  const req2 = normalizeOrderRequest('req_excess', {
    requestReference: 'REQ-EXCESS-1',
    customerUid: 'cust_2',
    customerName: 'Ziyad',
    customerContact: '0509998888',
    items: [{ itemId: 'spanish-latte-04m', quantity: 15 }], // stock is 10
    status: 'pending_review',
  });
  store.seedRequest(req2);

  await assert.rejects(
    () => approveAndPromoteOrderRequest({ store, requestId: 'req_excess', actor: ADMIN }),
    (err: unknown) =>
      err instanceof OrderWorkflowError &&
      err.code === 'VERIFICATION_FAILED' &&
      err.issues.some((i) => i.code === 'INSUFFICIENT_STOCK')
  );
  assert.equal(store.orders.has(getDeterministicOrderId('req_excess')), false);
});

test('08. Stage 04M Legacy order compatibility and Spark rules separation check', () => {
  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  const prodRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

  assert.ok(sparkRules.includes('match /orderRequests/{requestId}'));
  assert.ok(sparkRules.includes('match /orders/{orderId}'));
  assert.ok(prodRules.includes('match /orders/{orderId}'));
  // Ensure no Blaze cloud functions in project dependencies
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.equal('firebase-functions' in (pkg.dependencies || {}), false);
});

test('09. Stage 04N.2.4 Customer App payload interop, stock deduction, and legacy under_review/in_review -> reviewing normalization', async () => {
  const store = createStage04MMockStore();
  // Simulate a request written by Customer App with orderNote, requestSource, legacy 'under_review'/'in_review' status
  store.requests.set('req_cust_app_1', {
    requestId: 'req_cust_app_1',
    requestReference: 'REQ-CUSTAPP1',
    customerUid: 'cust_real_1',
    customerName: 'Laila Mansour',
    customerContact: '+966509876543',
    orderType: 'pickup',
    pickupType: 'pickup',
    currency: 'SAR',
    orderNote: 'Light ice please',
    items: [{ itemId: 'spanish-latte-04m', quantity: 3 }],
    status: 'under_review',
    reviewStatus: 'in_review',
    requestSource: 'customer-app-spark',
  });

  const normalized = normalizeOrderRequest('req_cust_app_1', store.requests.get('req_cust_app_1')!);
  assert.equal(normalized.status, 'reviewing');
  assert.equal(
    normalizeOrderRequest('req_in_rev', { items: [], status: 'in_review' }).status,
    'reviewing'
  );
  assert.equal(
    normalizeOrderRequest('req_rev', { items: [], status: 'reviewing' }).status,
    'reviewing'
  );
  assert.equal(normalized.notes, 'Light ice please');
  assert.equal(normalized.sourceApp, 'customer-app-spark');

  const promo = await approveAndPromoteOrderRequest({
    store,
    requestId: 'req_cust_app_1',
    actor: ADMIN,
  });
  assert.equal(promo.order.sourceRequestId, 'req_cust_app_1');
  assert.equal(promo.order.requestReference, 'REQ-CUSTAPP1');
  assert.equal(promo.order.totalBill, 64.5);
  assert.equal(promo.request.verifiedTotalSar, 64.5);
  assert.equal(promo.request.verifiedPricing?.totalSar, 64.5);
  assert.equal(promo.request.verifiedPricing?.totalBillSar, 64.5);
  assert.equal(store.menu.get('spanish-latte-04m')?.stockQuantity, 7);
});

test('10. Stage 04N.2.4 contract parity: palm-metric-app config, dual UIDs, 4 emails, canonical reviewing rules, and nested auditLogs', () => {
  const sparkRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.spark.rules'), 'utf8');
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  );
  const appletCfg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8')
  );
  const firebaseTs = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/firebase.ts'), 'utf8');

  assert.equal(appletCfg.projectId, 'palm-metric-app');
  assert.equal(appletCfg.firestoreDatabaseId, '(default)');
  assert.ok(firebaseTs.includes("projectId: 'palm-metric-app'"));

  for (const uid of BOOTSTRAPPED_ADMIN_UIDS) {
    assert.ok(sparkRules.includes(`'${uid}'`), `Spark rules include Admin UID ${uid}`);
  }
  for (const email of BOOTSTRAPPED_ADMIN_EMAILS) {
    assert.ok(sparkRules.includes(`'${email}'`), `Spark rules include Admin email ${email}`);
  }

  assert.ok(
    sparkRules.includes("nextStatus in ['reviewing', 'verified', 'rejected', 'order_created']"),
    'Spark rules emit canonical reviewing transition'
  );
  assert.ok(
    blueprint.entities.OrderRequest.properties.status.enum.includes('reviewing'),
    'Blueprint OrderRequest status enum includes reviewing'
  );
  assert.ok(
    !blueprint.entities.OrderRequest.properties.status.enum.includes('under_review'),
    'Blueprint OrderRequest status enum removes under_review'
  );
  assert.ok('/orderRequests/{requestId}/auditLogs/{logId}' in blueprint.firestore);
});
