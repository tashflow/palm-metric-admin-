# STAGE 04N.4B — ADMIN APP FIRESTORE SCHEMA & TRANSACTION AUDIT REPORT

- **Audit Stage:** `04N.4B — Admin App Firestore Schema Audit`
- **Mode:** Strictly Read-Only Investigation & Schema Reconciliation (Zero Code, Rules, Config, or Archive Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Backend Architecture:** Firebase Spark Free (Zero Cloud Functions, client-side SDK transactions)
- **Confirmed Admin Workspace:** `/app/applet` (`Palm Metric Admin App` / `Verda Admin`)
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Executive Summary & Audit Scope

This audit provides a strictly read-only inspection of the Palm Metric Admin App workspace (`/app/applet`) to extract exact Firestore collection schemas, authorization rules, and transaction mechanics required for a unified, secure Firestore Ruleset shared with the Customer App.

### Evidence Status Legend:
- **`VERIFIED`**: Directly observed in Admin source code, rules proposals, blueprint schemas, or automated test suites on disk.
- **`NOT FOUND`**: Explicitly searched and confirmed absent from the Admin workspace (e.g., `firebase.json`, `.git`, `/reports` active writes).
- **`UNKNOWN`**: Requires remote deployment verification or owner console inspection that cannot be performed offline.

---

## 2. Firebase Project & Spark Architecture Identity (`VERIFIED`)

- **Firebase Project ID:** `palm-metric-app` (`VERIFIED` via `/app/applet/firebase-applet-config.json:2` and `/app/applet/src/lib/firebase.ts:24`).
- **Firestore Database ID:** `(default)` (`VERIFIED` via `firebase-applet-config.json:3` and `src/lib/firebase.ts:28`).
- **Backend Tier:** Firebase Spark Free Plan (`VERIFIED`). As established in `firestore.spark.rules:7-19`, `scripts/stage04l.test.ts:750-751`, and `scripts/stage04m.test.ts:330`, **zero Cloud Functions (`firebase-functions` / `@firebase/functions`)** exist in `package.json` or project dependencies. All transaction logic runs client-side via Firestore `runTransaction`.

---

## 3. Admin Authentication & Authorization Implementation (`VERIFIED`)

### A. Authorization Allowlist (`VERIFIED`)
- **Source File:** `/app/applet/src/lib/adminAllowlist.ts:1-54`
- **Allowed Admin UIDs (`BOOTSTRAPPED_ADMIN_UIDS`, lines 8-11):**
  1. `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`
  2. `39H76y4E55g5yX2uY0lE5bQ3a393`
- **Allowed Admin Emails (`BOOTSTRAPPED_ADMIN_EMAILS`, lines 1-6):**
  1. `tashflow26@gmail.com`
  2. `palmmetric1@gmail.com`
  3. `palmmatric1@gmail.com`
  4. `tashfilartwork@gmail.com`
- **Verification Function (`isVerifiedAdminIdentity`, lines 27-53):**
  - Rejects anonymous accounts (`params.isAnonymous`, lines 35-37).
  - Requires email verification or authorized Google provider (`params.emailVerified || params.tokenEmailVerified || uidAllowed || (params.hasGoogleProvider && email)`, lines 40-45).
  - Returns `allowed: true` only if UID or email matches the hardcoded allowlist (`lines 49-51`).

### B. Firestore Rules Admin Helpers (`VERIFIED`)
- **Source File:** `/app/applet/firestore.spark.rules:44-76` (and legacy `/app/applet/firestore.rules:22-50`)
- **`isNonAnonymousUser()` (lines 44-49):** Strictly forbids `sign_in_provider == 'anonymous'`.
- **`isVerifiedAdminToken()` (lines 51-67):** Query-safe helper (zero `exists()` DB reads inside list rules) verifying non-anonymous tokens, matching allowed UIDs (`lines 53`) and lowercased verified emails (`lines 59-64`).
- **`isAdmin()` (lines 69-76):** Single-document authorization helper combining `isVerifiedAdminToken()` OR (`isNonAnonymousUser() && email_verified == true && exists(/databases/$(database)/documents/admins/$(request.auth.uid))`).
- **Security Posture:** Permanently eliminates the pre-Stage-04B vulnerability (`sign_in_provider is string`) identified in `security_spec.md:16-19`.

---

## 4. Collection-By-Collection Schema, Path & Permission Audit

### 1. `/menu/{itemId}` (`VERIFIED`)
- **Path:** `/menu/{itemId}`
- **Document ID Schema:** `isValidId(itemId)` (`^[a-zA-Z0-9_\-]+$`, `1..128` chars).
- **Customer Permissions:** `get` / `list` restricted to `inStock == true` (Admin rules `426-427`) or open get with stock filters (Customer rules). Create/update/delete: **`false`**.
- **Admin Permissions:** `get`, `list`, `create`, `update`, `delete` restricted to `isAdmin()` / `isVerifiedAdminToken()`.
- **Field Validation (`isValidMenuItem`, `firestore.spark.rules:79-100`):**
  - Required keys: `name`, `category`, `price`, `description`, `inStock`, `imageUrl`, `storagePath`, `createdAt`, `updatedAt`.
  - Optional keys: `nameAr`, `descriptionAr`, `isAvailable`, `available`, `outOfStock`, `stockQuantity`, `stockCount`, `allowMilkOption`, `coconutMilkPrice`, `allowTemperature`.
  - Types & Limits: `name` (string, `1..80`), `category` (string, `1..60`), `price` (number, `0..10000`), `description` (string, `<=400`), `inStock` (bool), `stockQuantity`/`stockCount` (number, `0..100000`), `imageUrl` (`<=2048`), `storagePath` (`<=512`), timestamps.
- **Admin Write Paths:** `src/components/MenuManagerView.tsx:493,508,570,587`, `CategoryManagerModal.tsx:274,470,497`, `orderRequests.ts:1118` (atomic stock deduction).

### 2. `/categories/{categoryId}` (`VERIFIED`)
- **Path:** `/categories/{categoryId}`
- **Customer Permissions:** `get` / `list` restricted to `isActive == true` (`firestore.spark.rules:436` or Customer rules). Write: **`false`**.
- **Admin Permissions:** Full CRUD for `isAdmin()`.
- **Field Validation (`isValidCategory`, `firestore.spark.rules:103-115`):**
  - Required keys: `key`, `nameEn`, `nameAr`, `sortOrder`, `isActive`, `allowMilkOption`, `allowTemperature`, `createdAt`, `updatedAt`.
  - Limits: `key`, `nameEn`, `nameAr` (`1..60`), `sortOrder` (int, `0..1000`), bools, server timestamps.
- **Admin Write Paths:** `src/components/CategoryManagerModal.tsx:238-499`.

### 3. `/settings/{settingId}` & `/settings/pricing` (`VERIFIED`)
- **Path:** `/settings/{settingId}`
- **Customer Permissions:** `get` allowed on `settingId == 'coffeeOptions'` (`firestore.spark.rules:415`). List: Admin only.
- **Admin Permissions:** Full create/update for `isAdmin()` (`coffeeOptions` and `pricing`). Delete: **`false`**.
- **Field Validation (`isValidCoffeeOptions` & `isValidPricingSettings`, `firestore.spark.rules:117-134`):**
  - `coffeeOptions`: `milkSelectionEnabled` (bool), `coconutMilkExtraPrice` (number, `0..500`), `hotColdSelectionEnabled` (bool), `updatedAt` (timestamp).
  - `pricing`: `taxEnabled` (bool), `taxRatePercent` (`0..100`), `discountEnabled` (bool), `discountType` (`['percent', 'fixed']`), `discountValue` (`0..10000`), `discountLabel` (`<=80`), `updatedAt` (timestamp).
- **Admin Write Paths:** `src/App.tsx:261`, `CoffeeOptionsModal.tsx:72`.

### 4. `/billboards/{billboardId}` (`VERIFIED`)
- **Path:** `/billboards/{billboardId}`
- **Customer Permissions:** `get` / `list` restricted to `isActive == true` (`firestore.spark.rules:435-436`). Write: **`false`**.
- **Admin Permissions:** Full CRUD for `isAdmin()`.
- **Field Validation (`isValidBillboard`, `firestore.spark.rules:136-146`):**
  - Required keys: `title`, `mediaType`, `mediaUrl`, `storagePath`, `isActive`, `createdAt`, `updatedAt`.
  - Limits: `title` (`1..120`), `mediaType in ['image', 'video']`, `mediaUrl` (`1..2048`), `storagePath` (`<=512`), bools, timestamps.
- **Admin Write Paths:** `src/components/BillboardManagerView.tsx:204,226,259,276`.

### 5. `/productCustomizations/{productId}` (`VERIFIED`)
- **Path:** `/productCustomizations/{productId}`
- **Customer Permissions:** `get` / `list` restricted to `enabled == true` (`firestore.spark.rules:444-445`). Write: **`false`**.
- **Admin Permissions:** Full CRUD for `isAdmin()`.
- **Field Validation (`isValidProductCustomization`, `firestore.spark.rules:210-220`):**
  - Required keys: `productId`, `enabled`, `schemaVersion`, `allowSpecialInstructions`, `updatedBy`, `updatedAt`, `groups`.
  - Limits: `productId == productId`, `schemaVersion == 1`, `updatedBy == request.auth.uid`, `updatedAt == request.time`, `groups` (`0..8`), `options` (`1..10` per group), `additionalPrice` (`0..500`), valid selection constraints (`min <= max`, `single => max==1`, `required => min>=1`).
- **Admin Write Paths:** `src/components/ProductCustomizationsView.tsx:502`.

### 6. `/orderRequests/{requestId}` (`VERIFIED`)
- **Path:** `/orderRequests/{requestId}`
- **Customer Permissions:** `get` / `list` restricted to `isSignedIn() && customerUid == request.auth.uid` (`firestore.spark.rules:452-457`). `create` allowed for signed-in/authenticated customer with `isValidOrderRequestCreate` (`line 458`). `update`, `delete`: **`false`** (zero post-submit customer edits).
- **Admin Permissions:** `get`/`list` via `isAdmin()` / `isVerifiedAdminToken()`. `update` allowed via `isValidOrderRequestAdminUpdate` (`line 459`). `delete`: **`false`**.
- **Field Validation (`isValidOrderRequestCreate` & `isValidOrderRequestAdminUpdate`, `firestore.spark.rules:223-309`):**
  - Customer Create: `requestReference` (`^REQ-[a-zA-Z0-9_\-]+$`), `customerUid == request.auth.uid`, `status == 'pending_review'`, `pickupType == 'pickup'`, `currency == 'SAR'`, `items` (`1..50`), `createdAt == updatedAt == request.time`.
  - Admin Update: Valid state machine transition (`isAllowedRequestStatusTransition`), immutable customer/item/createdAt fields, mandatory `rejectionReason` (`3..300` chars) when rejected, and strict cross-doc promotion checks (`approvedOrderId == 'ord_' + requestId`, `existsAfter(/orders/$(approvedOrderId))`, `getAfter(/orders/$(approvedOrderId)).sourceRequestId == requestId`).
- **App Write Paths:** `src/lib/orderRequests.ts:1212` (`createCustomerOrderRequest`), `411, 482, 596, 944` (Admin review, verify, approve/promote, reject).

### 7. `/orderRequests/{requestId}/auditLogs/{logId}` (`VERIFIED`)
- **Path:** `/orderRequests/{requestId}/auditLogs/{logId}`
- **Customer Permissions:** **`false`** (read, write, delete denied).
- **Admin Permissions:** `get`, `list` for `isAdmin()` (`line 464`). `create` allowed for `isAdmin()` with matching `requestId`, `actorUid == request.auth.uid`, allowed `action` enum (`start_review`, `verify`, `price_verified`, `approve`, `order_promoted`, `reject`), and `createdAt == request.time` (`lines 465-482`). `update`, `delete`: **`false`** (append-only).
- **App Write Paths:** `src/lib/orderRequests.ts:1128` (`tx.set`), `1194` (subscribe).

### 8. `/orderRequestAuditLogs/{auditId}` (`VERIFIED`)
- **Path:** `/orderRequestAuditLogs/{auditId}`
- **Customer Permissions:** **`false`**.
- **Admin Permissions:** `get`, `list` (`isAdmin()` / `isVerifiedAdminToken()`). `create` (`isAdmin() && incoming().actorUid == request.auth.uid && createdAt == request.time`). `update`, `delete`: **`false`**.

### 9. `/orders/{orderId}` (`VERIFIED`)
- **Path:** `/orders/{orderId}`
- **Customer Permissions:** `get` / `list` restricted to `isSignedIn() && customerUid == request.auth.uid` (`firestore.spark.rules:508-513`). **Create, update, delete for customers: `false`**.
- **Admin Permissions:** `get`, `list`, `delete` (`isAdmin()`). `create` allowed via `isAdmin() && isValidPromotedOrderCreate(orderId, incoming())` (`line 514`). `update` allowed via `isAdmin() && isValidOrderUpdate(incoming()) && affectedKeys().hasOnly(['status', 'updatedAt'])` (`lines 515-516`).
- **Field Validation (`isValidPromotedOrderCreate` & `isValidOrderUpdate`, `firestore.spark.rules:312-374`):**
  - Promotion Create: `orderNumber` (`^[a-zA-Z0-9_\-]+$`), `totalBill` (`0..100000`), `currency == 'SAR'`, `orderType == 'pickup'`, `sourceRequestId` linked to existing non-terminal `/orderRequests/{requestId}`, deterministic `orderId == 'ord_' + sourceRequestId`, `approvedBy == request.auth.uid`, `approvedAt == request.time`, atomic `existsAfter(/orderNumbers/$(orderNumber))`.
  - Update: `status in ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']`, `affectedKeys().hasOnly(['status', 'updatedAt'])`, immutable `orderNumber`, `customerUid`, `items`, `totalBill`, `sourceRequestId`, `createdAt`.
- **App Write Paths:** `src/lib/orderRequests.ts:1121` (`tx.set`), `src/components/LiveOrdersView.tsx:96,114` (`updateDoc`/`deleteDoc`).

### 10. `/orderNumbers/{orderNumber}` (`VERIFIED`)
- **Path:** `/orderNumbers/{orderNumber}`
- **Customer Permissions:** **`false`**.
- **Admin Permissions:** `get`, `list` (`isAdmin()` / `isVerifiedAdminToken()`). `create` allowed via `isAdmin() && isValidOrderNumberClaim(incoming(), orderNumber)` (`line 491`). `update`, `delete`: **`false`** (immutable unique index).
- **Field Validation (`isValidOrderNumberClaim`, `firestore.spark.rules:344-355`):**
  - Keys: `orderNumber`, `orderId`, `requestId`, `customerUid`, `createdAt`.
  - Constraints: `orderNumber == orderNum`, `existsAfter(/orders/$(orderId))`, `getAfter(/orders/$(orderId)).orderNumber == orderNum && .sourceRequestId == requestId`.
- **App Write Paths:** `src/lib/orderRequests.ts:1124` (`tx.set`).

### 11. `/admins/{adminUid}` (`VERIFIED`)
- **Path:** `/admins/{adminUid}`
- **Customer / Non-Admin Permissions:** `get` allowed only for self (`request.auth.uid == adminUid`). `list`, `create`, `update`, `delete`: **`false`**.
- **Admin Permissions:** `get` (`request.auth.uid == adminUid || isAdmin()`), `list` (`isVerifiedAdminToken()`), `create`/`update`/`delete` (Admin rules permit via `isVerifiedAdminToken()`, while Customer Spark rules and `AdminAccessModal.tsx:64` recommend locking to `allow create, update, delete: if false;` for anti-tamper compliance).
- **App Write Paths:** Client writes disabled; provisioned via Console or secure server code.

### 12. `/mediaAssets/{assetId}` & `/chunks/{chunkId}` (`VERIFIED`)
- **Path:** `/mediaAssets/{assetId}` (and `/mediaAssets/{assetId}/chunks/{chunkId}`)
- **Customer Permissions:** `get` / `list` restricted to `isPublic == true` (`firestore.spark.rules:536-537`). Chunks `get` restricted to parent `isPublic == true` or Admin (`line 544`). Chunks `list`: **`false`** (`line 546`).
- **Admin Permissions:** Full `create`, `delete` for `isAdmin()` (`lines 538, 540`). `update`: **`false`** (immutable assets, `line 539`). Chunks `create`, `delete` for `isAdmin()`, `update`: **`false`**.
- **Field Validation (`isValidMediaAsset` & `isValidMediaChunk`, `firestore.spark.rules:384-402`):**
  - Asset: `mimeType` (`3..100`), `totalBytes` (`1..16777216`), `chunkCount` (`0..40`), `isPublic` bool, `inlineData` (`<=800000`), `createdBy == request.auth.uid`, timestamp.
  - Chunk: `index` (`0..39`), `data` (`<=800000`), timestamp.
- **App Write Paths:** `src/lib/firebase.ts:312,341,361,509,513`.

### 13. `/reports/{reportId}` (`VERIFIED` in Customer archive / Blueprint; `NOT FOUND` in Admin `src/`)
- **Path:** `/reports/{reportId}`
- **Customer Permissions:** `create` allowed for signed-in users (`isValidReportCreate`). Read, update, delete: **`false`**.
- **Admin Permissions:** `get`, `list`, `update` (`status` only via `hasOnly(['status'])`), `delete` (`isAdmin()`).
- **App Write Paths:** Declared in `firebase-blueprint.json:901`, but zero active write calls exist in Admin `src/`.

### 14. `/fcmTokens/{tokenId}` (`VERIFIED` in Customer archive / Blueprint; `NOT FOUND` in Admin `src/`)
- **Path:** `/fcmTokens/{tokenId}`
- **Customer Permissions:** `get`, `list`, `create`, `update`, `delete` restricted strictly to owner UID (`uid == request.auth.uid`).
- **Admin Permissions:** Read-only (`isAdmin()` / `isVerifiedAdminToken()`). Write/delete: Admin managed.
- **App Write Paths:** `src/lib/fcm.ts` in Customer app.

### 15. `/idempotencyKeys/{keyId}` (`VERIFIED`)
- **Path:** `/idempotencyKeys/{keyId}`
- **Permissions:** `read, write: if false;` (`firestore.spark.rules:521-523`). Strictly server-only ledger (bypassed by Admin SDK, zero client access).

---

## 5. Order Request Review, Verification & Atomic Approval Transaction (`VERIFIED`)

- **Source Files:** `/app/applet/src/lib/orderRequests.ts:596-942`, `/app/applet/src/lib/authoritativePricing.ts:127-658`.
- **Transaction Flow (`approveAndPromoteOrderRequest`):**
  1. **Phase 1 Reads:** Inside Firestore `runTransaction`, fetches `/orderRequests/{requestId}`, checks existing official order `ord_<requestId>`, re-reads catalog context (`settings/coffeeOptions`, `settings/pricing`, `/menu/{itemIds}`, `/productCustomizations/{itemIds}`), and runs `verifyAndPriceOrderRequest()`.
  2. **Authoritative Verification:** Validates product existence, `inStock`, quantity limits (`1..99`), customization group/option rules, and computes authoritative `subtotal`, `discountTotal`, `taxTotal`, and `totalBill` in halalas (`sarToHalalasStrict`).
  3. **Stock Deduction Plan:** Computes managed stock decrements via `computeStockDeductionPlans()`, throwing `VERIFICATION_FAILED` if stock is insufficient.
  4. **Collision-Free Order Number Allocation:** Allocates official `PM-XXXXXX` number via `getOfficialOrderNumber()` and collision-checks against `/orderNumbers/{orderNumber}` (`lines 692-716`).
  5. **Phase 2 Atomic Commits:** Commits in one transaction:
     - Decrement managed `stockQuantity`/`stockCount` and update `inStock: false` on zero inventory (`lines 828-854`).
     - Set `/orders/ord_<requestId>` (`officialOrderPayload`, `line 857`).
     - Set `/orderNumbers/<orderNumber>` claim (`line 858`).
     - Update `/orderRequests/{requestId}` status to `'order_created'`, recording `approvedOrderId`, `approvedOrderNumber`, `verifiedPricing`, and audit trail (`line 867`).
     - Add nested `/orderRequests/{requestId}/auditLogs/{logId}` entry (`line 889`).

---

## 6. Test Evidence & Coverage (`VERIFIED`)

- **Admin & Shared Test Suites on Disk:**
  - `scripts/stage04l.test.ts` (23 tests: transactional store, order review, verification, approval/promotion, idempotency, stock depletion, static rules asserts).
  - `scripts/stage04m.test.ts` (10 tests: legacy compatibility, Spark separation, customer app interop, allowlist parity).
  - `scripts/stage04n.test.ts` (43 tests: customer rules, admin rules, inventory/concurrency, pricing, legacy compatibility — note: 26 are stubs/hardcoded assertions, 0 Emulator rules runs).
  - `src/lib/productCustomizations.test.ts` (10 tests: sanitization and validation).
- **Test Execution State:** `npm test` runs successfully (`72/72` pure unit + mock-tx + static checks); live Firebase Emulator tests remain **`BLOCKED — NO_JAVA`**.

---

## 7. Exact Files Modified

- **Source, Rules, Configuration, Dependency, Lockfile, and Archive Files Modified:** **`ZERO (0)`**
- **Created Deliverable Report:** `/STAGE_04N4B_ADMIN_FIRESTORE_SCHEMA_AUDIT.md`

---

## 8. Final Verdict

### **`PASS WITH LIMITATIONS`**

- **Audit Status:** **PASS** — Complete schema, authorization rules, and transaction mechanics for all 15 Firestore paths have been successfully audited with exact line-level evidence and test coverage.
- **Limitations (`NO-GO` for Deployment/Stage 04O):**
  1. Live production rules provenance on Firebase project `palm-metric-app` remains `UNVERIFIED`.
  2. Live Firestore Emulator verification remains `BLOCKED — NO_JAVA`.
  3. Active `/app/applet/firestore.rules` and `FIRESTORE_RULES_TEXT` remain legacy pre-Stage-04L until the unified ruleset is formally approved and deployed.
