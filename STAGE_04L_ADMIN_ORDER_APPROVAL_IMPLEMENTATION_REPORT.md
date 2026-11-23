# STAGE 04L — ADMIN ORDER APPROVAL & PROMOTION IMPLEMENTATION REPORT

**Project:** Palm Metric Admin App (`palm-metric-app`)  
**Firestore Database:** `(default)`  
**Customer App URL:** `https://tashflow.github.io/Palm-Metric/`  
**Admin App URL:** `https://tashflow.github.io/palm-metric-admin-/`  
**Admin Repository:** `https://github.com/tashflow/palm-metric-admin-`  
**Currency:** `SAR`  
**Order Fulfillment Type:** `Pickup only`  
**Implementation Mode:** Firebase Spark Compatible (Zero Cloud Functions)  
**Date:** November 22, 2026  

---

## 1. Executive Summary

Stage 04L (**Admin Order Approval & Promotion System**) has been implemented in the Palm Metric Admin App using a **Firebase Spark–compatible** architecture (zero Cloud Functions, zero Blaze-only SDK dependencies). Administrators can monitor incoming customer requests in `/orderRequests/{requestId}` in real time, verify product availability, stock quantities, customizations, and authoritative SAR prices (computed exclusively from Admin catalog documents in integer **halalas**), move requests into review or verification states, reject invalid requests with a mandatory rejection reason, and atomically approve and promote valid requests into official orders under `/orders/ord_<requestId>` with official `#PM-xxxxxx` numbers and append-only audit logs.

**Critical Upstream Discovery:**
During initial inspection (Step 1), the upstream Stage 04K report (`STAGE_04K_CUSTOMER_ORDER_REQUEST_IMPLEMENTATION_REPORT.md`), `firestore.spark.rules`, and `scripts/stage04k.test.ts` were **not present** in either the local Admin workspace (`/app/applet`) or the live GitHub `main` branches (`tashflow/Palm-Metric` and `tashflow/palm-metric-admin-`). Accordingly:
- The Customer App (`tashflow/Palm-Metric`) repository was **not modified** (per strict constraints), so live Customer App Stage 04K request creation has not been deployed upstream.
- Inside the Admin App's existing storefront simulator (`src/components/CustomerStorefrontPreview.tsx`), end-to-end Stage 04K/04L `/orderRequests` submission and 4-stage customer status tracking (`Submitted -> Admin Review -> Verified -> Order Created`, rejection reason display, and linked official `#PM-...` order status) were implemented so the workflow can be exercised safely.
- Production `/firestore.rules` and the live `palm-metric-app` `(default)` database were **not modified or deployed**. Proposed Stage 04L Spark rules were written cleanly to `/firestore.spark.rules` alongside `/firebase-blueprint.json` updates.

---

## 2. Inspection Report Findings

Initial codebase and repository inspection verified the following baseline facts before any edits were made:

1. **Workspace Runtime & Package Stack:** React 19 + Vite 8 + TypeScript + Tailwind CSS v4 + Firebase JS SDK v13.3.0 (`package.json`), running on port `3000`. No `firebase-functions` or `@firebase/functions` dependencies exist anywhere in `package.json`.
2. **Firebase Configuration (`src/lib/firebase.ts`, `firebase-applet-config.json`):** Configured for `projectId: "palm-metric-app"` and `(default)` Firestore database.
3. **Production Rules Baseline (`/firestore.rules` + `src/lib/firestoreRulesText.ts`):** Existing test `src/lib/productCustomizations.test.ts` asserts exact equality between `/firestore.rules` and `FIRESTORE_RULES_TEXT`. Leaving production `/firestore.rules` untouched preserves Stage 04B/04C invariants while Stage 04L Spark rules live separately in `/firestore.spark.rules`.
4. **Admin Authentication & Role Checks (`src/contexts/AuthContext.tsx`, `src/lib/adminAllowlist.ts`):** Google Sign-In (`signInWithPopup`) checks `isAnonymous` (auto signs out anonymous sessions), requires verified Google/email accounts, and verifies either bootstrapped allowlist (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, UID `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`) or `/admins/{uid}` membership.
5. **Existing `/orders` Schema (`src/types/index.ts`, `src/components/LiveOrdersView.tsx`):** Orders already include Stage 04E optional fields (`subtotal`, `discountTotal`, `taxTotal`, `currency`, `orderType`, `paymentStatus`, `sourceApp`, `idempotencyKey`, `pricingVersion`) alongside legacy fields (`orderNumber`, `customerUid`, `customerName`, `customerContact`, `items`, `totalBill`, `status`, `notes`, `createdAt`, `updatedAt`).
6. **Catalog, Modifiers, and Customizations (`src/lib/modifiers.ts`, `src/lib/productCustomizations.ts`):** Catalog pricing lives in `/menu/{itemId}`, global modifiers in `/settings/coffeeOptions`, category overrides in `/categories/{categoryId}`, and granular customization groups/options in `/productCustomizations/{productId}`.
7. **Existing Customer App Upstream Repo (`github.com/tashflow/Palm-Metric` `main`):** Contains Stage 04E Cloud Functions (`functions/src/{types.ts, orderPricing.ts, orderValidation.ts, orderCreation.ts}`), production `firestore.rules`, and `scripts/audit-rules.mjs`. Neither `STAGE_04K_CUSTOMER_ORDER_REQUEST_IMPLEMENTATION_REPORT.md` nor `firestore.spark.rules` existed in `tashflow/Palm-Metric` at inspection time.
8. **Environment CLI Tools:** `python3` (`/usr/bin/python3`) and `firebase` (`/usr/local/bin/firebase`) are installed, while `java` is **not installed** in the sandbox container (blocking local Firestore Emulator rules execution).

---

## 3. Collections, Schema Changes, and Legacy Compatibility

Updated `/firebase-blueprint.json` and `/src/types/index.ts` while preserving 100% backward compatibility with all pre-existing `/orders` and `/menu` documents:

### `/orderRequests/{requestId}` (`OrderRequest`)
- **Identity & Ownership:** `requestReference` (`REQ-...`), `customerUid`, `customerName`, `customerContact`, `pickupType: 'pickup'`, optional `pickupWindow`, `notes`, `lang`, `sourceApp`.
- **Requested Line Items (`items[]`):** Supports `itemId` and legacy alias `productId`, `quantity`, `milkOption`, `temperature`, `selectedCustomizations` / `selectedByGroup`, `specialInstructions`, plus untrusted client-submitted reference fields (`submittedUnitPrice`, `submittedLineTotal`, `price`).
- **Workflow States:**
  - `status`: `'pending_review' | 'under_review' | 'verified' | 'rejected' | 'order_created'`
  - `reviewStatus`: `'unreviewed' | 'in_review' | 'verified' | 'needs_attention' | 'approved' | 'rejected'`
- **Authoritative Outputs:** `verifiedPricing` (`VerifiedPricingBreakdown`), `verifiedItems` (`VerifiedOrderLineItem[]`), `approvedOrderId`, `approvedOrderNumber`, `approvedBy`/`approvedAt`, `rejectedBy`/`rejectedAt`/`rejectionReason`, and bounded `auditTrail` summary (up to 25 snapshots).

### `/orderRequests/{requestId}/auditLogs/{logId}` (`OrderRequestAuditLog`)
- Immutable append-only audit records capturing `action` (`'start_review' | 'verify' | 'price_verified' | 'approve' | 'order_promoted' | 'reject'`), `actorUid`, `actorEmail`, `actorRole: 'admin'`, `fromStatus`, `toStatus`, `note` / `rejectionReason`, `approvedOrderId`, `approvedOrderNumber`, `verifiedTotalSar`, `createdAtIso`, and `createdAt`.

### `/orders/{orderId}` (`Order`)
- Expanded `OrderStatus` to include `'Cancelled'` alongside `Pending -> Preparing -> Ready -> Completed`.
- Preserves all legacy fields and adds Stage 04E/04L traceability fields: `requestId`, `requestReference`, `approvedBy`, `approvedByEmail`, `approvedAt`, `subtotal`, `discountTotal`, `taxTotal`, `currency: 'SAR'`, `orderType: 'pickup'`, `paymentStatus: 'pay_at_pickup'`, `idempotencyKey`, `pricingVersion`.
- Added compatibility availability/stock fields on `MenuItem` (`inStock`, `isAvailable`, `available`, `outOfStock`, `stockQuantity`).

### Optional `/settings/pricing` (`PricingConfigSettings`)
- Optional configuration read inside transactions if present (`taxEnabled`, `taxRatePercent`, `discountEnabled`, `discountType`, `discountValue`, `discountLabel`). Zero tax and zero discount are applied unless explicitly enabled here.

---

## 4. Admin Authentication and Role Enforcement Verification

- **Frontend Session Gating (`src/contexts/AuthContext.tsx`):**
  - Only Google Sign-In (`googleProvider`) is active; anonymous sessions (`currentUser.isAnonymous`) are immediately signed out.
  - Non-admin signed-in users receive `denialReason: 'not_admin'` and cannot mount `AdminDashboard` or subscribe to `/orderRequests` or `/orders`.
  - Pure email allowlist helpers were extracted into `src/lib/adminAllowlist.ts` and re-exported from `src/lib/firebase.ts` so headless unit tests validate admin logic without opening Firebase network sockets.
- **Actor Assertion (`src/lib/orderRequests.ts`):**
  - `assertValidAdminActor(actor)` rejects empty or missing `actor.uid` with `OrderWorkflowError('UNAUTHORIZED_ADMIN')`.
- **Spark Rules Enforcement (`/firestore.spark.rules`):**
  - `isAdmin()` requires `isNonAnonymousUser()`, verified email, and either verified admin UID/email allowlist or `/admins/{uid}` record.
  - All Admin-only updates/promotions on `/orderRequests` and `/orders` enforce `isAdmin()` server-side in Firestore Security Rules.

---

## 5. Admin Order Requests Dashboard Implementation

Implemented in `src/components/OrderRequestsView.tsx`, `src/App.tsx`, `src/components/LiveOrdersView.tsx`, and `src/i18n/translations.ts` (full bilingual English + Arabic RTL support):

- **Single Shared Real-Time Subscription (`src/App.tsx`):**
  - `subscribeAdminOrderRequests(db, ...)` opens one ordered `onSnapshot` listener when authenticated Admin state is verified and unsubscribes cleanly on unmount/logout.
  - Pending/active request badge counter updates live on both desktop sidebar navigation and mobile quick-tab strip.
- **Filtering, Search & Sorting (`OrderRequestsView.tsx`):**
  - Status tabs with live counts: `All`, `Pending Review`, `Under Review`, `Verified`, `Rejected`, `Order Created`.
  - Instant search across `REQ-...` reference, request ID, customer name, customer contact, official `#PM-...` order number, and item names.
  - Toggleable sort (`Newest First` / `Oldest First`).
- **Detailed Request Review Pane (`OrderRequestsView.tsx`):**
  - Displays request header, `Pickup Only` badge, customer contact & pickup window, customer notes, item-level verification tags (`In Stock` / `Unavailable`), base price + customization surcharges + verified unit/line totals in SAR, client price mismatch warnings, verification blockers, confirmation modal (`#PM-...` + deterministic `ord_<requestId>` preview), mandatory rejection reason modal, and live audit log feed (`subscribeOrderRequestAuditLogs` with clean unmount cleanup and fallback to embedded `auditTrail`).
  - Cross-navigation button **View Official Order** switches directly to `LiveOrdersView` and highlights the promoted order card (`highlightedOrderId`).
- **Live Orders Compatibility (`LiveOrdersView.tsx`):**
  - Displays originating `REQ-...` reference badge, `Pickup Only` indicator, `Cancelled` status badge & filter, and visual ring highlight when navigated from `OrderRequestsView`.

---

## 6. Authoritative Pricing and Verification Logic

Implemented in `src/lib/authoritativePricing.ts` (`AUTHORITATIVE_PRICING_VERSION = 2`):

1. **Integer Halalas Math (`1 SAR = 100 halalas`):** All base prices, modifier surcharges, customization option add-ons, subtotals, configured discounts, configured taxes, and totals are converted to integer halalas (`sarToHalalasStrict`) and formatted back via `halalasToSar` to eliminate floating-point drift (e.g., `18.10 + 2.20 = 20.30 SAR`).
2. **Untrusted Client Data Ignored:** Client-submitted `submittedUnitPrice`, `submittedLineTotal`, `price`, `clientEstimatedTotal`, and option `additionalPrice` values are strictly ignored during price calculation. If the client estimate differs from the authoritative SAR total (`> 1 halala`), a non-blocking `CLIENT_PRICE_MISMATCH` warning is surfaced in the Admin review UI while the authoritative total governs promotion.
3. **Catalog & Availability Verification (`isMenuItemAvailableForOrder`):**
   - Rejects missing/deleted product IDs (`UNKNOWN_PRODUCT`).
   - Rejects invalid quantities (`INVALID_QUANTITY`, must be integer `1..50`).
   - Rejects disabled/out-of-stock items checking `inStock`, `isAvailable`, `available`, and `outOfStock` (`OUT_OF_STOCK`).
   - Enforces numeric `stockQuantity` bounds when configured on the menu item (`INSUFFICIENT_STOCK`).
4. **Customization & Legacy Modifier Validation:**
   - When `/productCustomizations/{productId}` exists and `enabled === true`, verifies all selected `(groupId, optionId)` pairs against active groups and enabled options (`INVALID_OR_DISABLED_OPTION`), enforces `required` / `minSelections` (`REQUIRED_GROUP_MISSING`, `MIN_SELECTIONS_NOT_MET`), and enforces `maxSelections` (`MAX_SELECTIONS_EXCEEDED`).
   - When `productCustomizations` is absent or disabled, falls back cleanly to legacy category/`coffeeOptions` modifiers (`milkOption` regular/coconut extra pricing + Hot/Cold temperature).
5. **Configured Discounts & Taxes:** Reads `/settings/pricing` if configured. Unconfigured stores receive `discountSar: 0` and `taxSar: 0` (zero invented fees or rates).

---

## 7. Approval and Official Order Promotion Transaction Flow

Implemented in `src/lib/orderRequests.ts` (`approveAndPromoteOrderRequest` & `createFirestoreOrderRequestStore`):

1. **Atomic Transaction (`runTransaction`):**
   - Reads `/orderRequests/{requestId}` and deterministic target `/orders/ord_<requestId>`.
   - Re-reads `/settings/coffeeOptions`, `/settings/pricing`, each referenced `/menu/{itemId}`, and `/productCustomizations/{itemId}` **inside the transaction**.
   - Runs `verifyAndPriceOrderRequest(...)` inside the transaction; if any item became unavailable, out of stock, or invalid right before commit, aborts atomically with `VERIFICATION_FAILED` and creates **zero** `/orders` documents.
2. **Deterministic Order Identity:**
   - Document ID: `ord_<sanitizedRequestId>` (`getDeterministicOrderId`).
   - Official Order Number: `PM-<6-digit deterministic FNV-1a suffix>` (`getOfficialOrderNumber`).
3. **Atomic Writes Committed Together:**
   - Creates `/orders/ord_<requestId>` with canonical verified line items, `totalBill`, `subtotal`, `discountTotal`, `taxTotal`, `currency: 'SAR'`, `orderType: 'pickup'`, `paymentStatus: 'pay_at_pickup'`, `status: 'Pending'`, `requestId`, `requestReference`, `approvedBy`, and server timestamps.
   - Updates `/orderRequests/{requestId}` to `status: 'order_created'`, `reviewStatus: 'approved'`, `approvedOrderId`, `approvedOrderNumber`, `verifiedPricing`, `verifiedItems`, and bounded `auditTrail`.
   - Writes immutable `/orderRequests/{requestId}/auditLogs/{logId}` records (`price_verified`, `approve`, `order_promoted`).

---

## 8. Duplicate Approval and Concurrency Protection

- **Transaction Re-Check + Deterministic ID:** Every approval targets `orders/ord_<requestId>`. Before writing, `approveAndPromoteOrderRequest` checks both `req.status === 'order_created'` and `existingOfficialOrder = tx.getOrder('ord_<requestId>')`.
- **Idempotent Replay:** If Admin B clicks Approve concurrently or retries after Admin A has promoted the request, Firestore's optimistic transaction serializes/re-evaluates and `approveAndPromoteOrderRequest` returns `{ idempotentReplay: true, order: existingOfficialOrder, request: req }` without creating a second order or overwriting the original official order.
- **Rules-Level Enforcement (`/firestore.spark.rules`):**
  - `!exists(/databases/$(database)/documents/orders/$(orderId))` guarantees an official promoted order document cannot be overwritten or re-created.
  - `get(.../orderRequests/$(data.requestId)).data.status in ['pending_review', 'under_review', 'verified']` combined with `getAfter(...).data.status == 'order_created'` and `existsAfter(.../orders/$(data.approvedOrderId))` ties creation and request status transition atomically.

---

## 9. Rejection Workflow and Rejection Reason Rules

Implemented in `rejectOrderRequest` (`src/lib/orderRequests.ts`) and UI modal (`OrderRequestsView.tsx`):

- **Mandatory Non-Empty Reason:** Whitespace-only or empty reasons are rejected client-side and domain-side (`OrderWorkflowError('REJECTION_REASON_REQUIRED')`), and blocked in `/firestore.spark.rules` (`data.rejectionReason.size() >= 1 && data.rejectionReason.size() <= 300`).
- **Terminal State Enforcement:** Rejected requests set `status: 'rejected'`, `reviewStatus: 'rejected'`, `rejectedBy`, `rejectedAt`, and `rejectionReason`. Subsequent attempts to `startOrderRequestReview`, `verifyOrderRequest`, or `approveAndPromoteOrderRequest` fail with `ALREADY_REJECTED` (and Spark rules disallow any transition out of `'rejected'`).
- **UI Protection:** Once rejected, action buttons (`Start Review`, `Verify Request`, `Approve & Create Order`, `Reject Request`) are removed and replaced with the recorded rejection banner.

---

## 10. Audit Trail Implementation

- Every state transition writes structured entries to both:
  1. Subcollection `/orderRequests/{requestId}/auditLogs/{logId}` (append-only in Spark rules: `allow create` restricted to valid Admin actions; `allow update, delete: if false;`, customer read/list denied).
  2. Bounded `auditTrail` summary array (latest 25 entries) on `/orderRequests/{requestId}` for quick detail-panel fallback if subcollection reads are restricted before rules update.
- Recorded actions: `submitted` (initial customer snapshot), `start_review`, `verify`, `price_verified`, `approve`, `order_promoted`, and `reject`.

---

## 11. Customer App Tracking Integration Confirmation

- **Implemented Scope (Admin App Storefront Simulator — `src/components/CustomerStorefrontPreview.tsx`):**
  - Customer checkout now creates Stage 04K/04L requests in `/orderRequests` via `createCustomerOrderRequest` instead of writing directly to `/orders`.
  - Customer tracking card renders a 4-stage live progress tracker (`Submitted -> Admin Review -> Verified -> Order Created`), displays verified SAR totals once priced, surfaces Admin `rejectionReason` cleanly on rejected requests, and links to live fulfillment status (`Pending -> Preparing -> Ready -> Completed`) from the promoted `#PM-...` official order.
- **Live Upstream Customer App (`https://tashflow.github.io/Palm-Metric/` / `github.com/tashflow/Palm-Metric`) Status:**
  - **NOT MODIFIED / NOT PRESENT UPSTREAM:** Inspection confirmed `tashflow/Palm-Metric` (`main`) still does not contain Stage 04K `/orderRequests` submission or tracking UI. Full end-to-end live Customer App integration awaits deploying Stage 04K in `tashflow/Palm-Metric` alongside publishing `firestore.spark.rules`.

---

## 12. Proposed Firestore Spark Security Rules (`/firestore.spark.rules`)

Created cleanly in `/firestore.spark.rules` without modifying production `/firestore.rules`. Key protections:

- Global default-deny fallback: `match /{document=**} { allow read, write: if false; }`.
- Zero `sign_in_provider is string` vulnerability; anonymous tokens explicitly excluded (`sign_in_provider != 'anonymous'`).
- **Owner-scoped `/orderRequests/{requestId}`:**
  - Customers can `create` only with `customerUid == request.auth.uid`, `pickupType == 'pickup'`, `status == 'pending_review'`, `reviewStatus == 'unreviewed'`, and server timestamps.
  - Customers can `get`/`list` **only** their own requests (`customerUid == request.auth.uid`).
  - Customers **cannot** `update` or `delete` requests post-submit.
  - Admins can `update` only valid state transitions from `pending_review | under_review | verified`, while `customerUid`, `requestReference`, `items`, `pickupType`, and `createdAt` remain locked/immutable.
  - Rejection updates require `rejectionReason` (`1..300` chars) and disallow `approvedOrderId`.
  - Promotion updates require `approvedOrderId == 'ord_' + requestId`, verified pricing map (`currency == 'SAR'`), and `existsAfter(/databases/$(database)/documents/orders/$(data.approvedOrderId))`.
- **Append-only `/orderRequests/{requestId}/auditLogs/{logId}`:** Admin-only read/create, `allow update, delete: if false;`.
- **Locked-down `/orders/{orderId}`:** Direct customer creation blocked; only Admin promoted writes tied atomically via `orderId == 'ord_' + data.requestId`, `!exists(.../orders/$(orderId))`, `exists(.../orderRequests/...)`, and `getAfter(.../orderRequests/...)`.

---

## 13. Security Limitation Disclosure

**IMPORTANT SPARK ARCHITECTURAL BOUNDARY:**  
Because Firebase **Spark** plan does not support Cloud Functions or server-side Admin SDK triggers:
- Firestore Security Rules cleanly enforce authentication, Admin allowlists, customer PII isolation, request immutability after submission, terminal state locks (`rejected` / `order_created`), mandatory rejection reasons, append-only audit logs, and deterministic 1:1 request-to-order promotion.
- However, **Firestore Security Rules cannot iterate dynamic arrays (`items[]`) to cross-fetch `/menu/{itemId}` and `/productCustomizations/{productId}` and perform server-side catalog arithmetic.**
- Therefore, under Spark, authoritative SAR calculation (`verifyAndPriceOrderRequest`) executes inside a **trusted, authenticated Admin client session transaction** rather than inside Google Cloud backend compute. Upgrading to Firebase **Blaze** (Cloud Functions v2 / Stage 04E pattern) is recommended if server-enforced pricing computation independent of the Admin browser is required.

---

## 14. Static Rules and Schema Verification Results

| Check | Scope | Result | Notes |
|---|---|---|---|
| Default-deny rule | `firestore.spark.rules` | **PASS** | `match /{document=**} { allow read, write: if false; }` present |
| No legacy `sign_in_provider` escalation | `firestore.spark.rules` | **PASS** | Verified via static assertion in Test 20 |
| No Cloud Functions / Blaze deps | `package.json`, `src/`, `scripts/` | **PASS** | `grep` confirmed zero `firebase-functions`, `@firebase/functions`, `firebase/functions`, or `httpsCallable` |
| No private keys or secrets | Workspace source & rules | **PASS** | `grep` confirmed zero private keys / service credentials |
| Production `firestore.rules` untouched | `/firestore.rules` vs `FIRESTORE_RULES_TEXT` | **PASS** | `productCustomizations.test.ts` Test 10 passed |
| `firebase-blueprint.json` valid JSON & entities | `/firebase-blueprint.json` | **PASS** | Verified `/orderRequests/{requestId}`, `/auditLogs/{logId}`, `/orders/{orderId}` |
| Firebase Emulator Live Rules Test | `firestore.spark.rules` | **BLOCKED (Java Missing)** | `which java` returned empty; Java JRE is not installed in sandbox container |

---

## 15. Build and Compilation Results

Verified directly after final code and test edits:

1. **TypeScript Type-Check (`npm run lint` / `tsc --noEmit`):**
   - Command: `tsc --noEmit` via `lint_applet`
   - Result: **PASS** (0 errors, exit code 0)
2. **Production Bundle Compilation (`vite build`):**
   - Command: `compile_applet`
   - Result: **PASS** (`Build succeeded - the applet is compiled`)

---

## 16. Automated Test Results

Executed directly via `npx tsx --test scripts/stage04l.test.ts src/lib/productCustomizations.test.ts`:

- **Total Tests Executed:** `28`
- **Passed:** `28`
- **Failed:** `0`
- **Duration:** `1421.8 ms`

### Breakdown:
1. **`scripts/stage04l.test.ts` (18 test blocks covering Stage 04L Scenarios 01–22):** **18/18 PASS**
   - Admin auth & allowlist boundary enforcement
   - Spark rules non-admin & anonymous boundary checks
   - `pending_review` normalization, 5-status filtering, `REQ-` search
   - `under_review` transition + audit entry
   - Authoritative SAR pricing ignoring tampered client prices + mismatch warning
   - Integer halalas precision without floating-point drift
   - Rejection of nonexistent products, out-of-stock items, insufficient `stockQuantity`, disabled options, missing required groups, and exceeded `maxSelections`
   - Atomic `/orders/ord_<requestId>` creation (`#PM-...`) + `/orderRequests` status transition
   - Concurrent/duplicate approval by two admins producing strictly 1 official order (`idempotentReplay`)
   - Mandatory rejection reason + post-rejection approval blocking
   - Customer post-submit mutation prevention & `customerUid` isolation in `firestore.spark.rules`
   - Append-only audit logs (`start_review -> verify -> price_verified -> approve -> order_promoted`)
   - Static security audit (`firestore.spark.rules`, `firebase-blueprint.json`, zero Cloud Functions deps)
   - Explicit `/settings/pricing` tax/discount vs zero default
   - Transaction abort on mid-flight stock loss before commit
2. **`src/lib/productCustomizations.test.ts` (Pre-existing Stage 04B/04C suite):** **10/10 PASS**
3. **Stage 04D / Stage 04K Upstream Test Suites:** **NOT PRESENT** (neither test suite exists in the repository or upstream `tashflow/Palm-Metric` `main`).
4. **Live Firestore Emulator Tests:** **BLOCKED / NOT RUN** (Java runtime absent in environment).

---

## 17. Live Firebase / Production Data Non-Modification Confirmation

- **Confirmed:** Zero writes, deletes, rule deployments, Cloud Function deployments, or auth mutations were executed against live Firebase project `palm-metric-app` (`(default)` database) or `github.com/tashflow/*`.
- Production `/firestore.rules` remains unmodified on disk and undeployed.

---

## 18. Changed Files List

### Newly Created Files
- `/src/lib/adminAllowlist.ts` — Pure admin email allowlist helpers (browser/test-safe).
- `/src/lib/authoritativePricing.ts` — Halalas SAR pricing engine and catalog/stock/customization validator.
- `/src/lib/orderRequests.ts` — Stage 04L transactional workflow engine, deterministic order ID/number generation, normalizer, Firestore store adapter, and real-time subscriptions.
- `/src/components/OrderRequestsView.tsx` — Admin Order Requests queue, filtering/search/sort, review & verification panel, approval/rejection modals, and audit log viewer.
- `/firestore.spark.rules` — Proposed Stage 04L Spark-compatible Firestore security rules (separate from production `/firestore.rules`).
- `/scripts/stage04l.test.ts` — Stage 04L automated unit & static security test suite (Scenarios 01–22).
- `/STAGE_04L_ADMIN_ORDER_APPROVAL_IMPLEMENTATION_REPORT.md` — This implementation report.

### Modified Files
- `/src/types/index.ts` — Stage 04L types, `OrderStatus` (`Cancelled`), `AdminTab` (`requests`), `OrderRequest*`, `Verified*`, `PricingConfigSettings`, `OrderRequestAuditEntry`, `VALIDATION_LIMITS.orderRequest`.
- `/src/lib/firebase.ts` — Re-exports `BOOTSTRAPPED_ADMIN_EMAILS` / `isBootstrappedAdminEmail` from `adminAllowlist.ts`.
- `/src/i18n/translations.ts` — Bilingual EN/AR translations for Order Requests dashboard, verification, pricing breakdown, modals, and `Cancelled` status.
- `/src/App.tsx` — Single `subscribeAdminOrderRequests` + `settings/pricing` listener, `requests` navigation tab + pending counter badge, cross-navigation to `LiveOrdersView`, and `orderRequests` prop to `CustomerStorefrontPreview`.
- `/src/components/LiveOrdersView.tsx` — Displays `requestReference` (`REQ-...`), `pickupOnlyBadge`, `nameAr`, `Cancelled` status filter/badge, and highlighted order navigation.
- `/src/components/CustomerStorefrontPreview.tsx` — Submits `/orderRequests`, displays 4-stage customer tracker, verified SAR pricing, rejection reason, and official `#PM-...` order link.
- `/firebase-blueprint.json` — Added `OrderRequest`, `OrderRequestAuditLog`, and Stage 04E/04L `Order` fields.

---

## 19. Unresolved Issues, Risks, and Limitations

1. **Missing Upstream Stage 04K Customer App Code:** `tashflow/Palm-Metric` does not yet implement `/orderRequests` submission or tracking in production. Until Customer App Stage 04K is built and deployed, live customer requests come only from Admin App Storefront Preview or direct `/orderRequests` writes.
2. **Proposed `firestore.spark.rules` Not Yet Published:** Because deployment is disallowed in this task and `/orderRequests` is not yet in production `/firestore.rules`, live Admin reads on `/orderRequests` will receive `permission-denied` (gracefully handled by `requestsRulesBlocked` UI notice) until an owner manually publishes `firestore.spark.rules` in Firebase Console (after verifying Stage 04K readiness on Customer App).
3. **Spark Rules vs Blaze Server Pricing:** Under Spark, catalog arithmetic integrity depends on authenticated Admin clients rather than Cloud Functions.
4. **Java Absent for Local Emulator Tests:** `firestore.spark.rules` passed static verification and TypeScript/regex checks, not live Firestore Emulator execution.

---

## 20. Explicit Final Verdict

**STAGE 04L — IMPLEMENTATION COMPLETE WITH LIMITATIONS**

All Stage 04L Admin Order Approval & Promotion architecture, authoritative SAR halalas pricing & stock/customization verification, atomic transactional promotion (`ord_<requestId>`, `#PM-...`), concurrent/duplicate idempotency protection, mandatory rejection workflow, append-only audit logging, Admin UI dashboard, Customer Storefront Preview Stage 04K/04L simulator, `firebase-blueprint.json` schema updates, separate `firestore.spark.rules` proposal, TypeScript compilation, Vite build, and 28/28 automated unit/static tests succeeded with zero modifications to production Firebase or `firestore.rules`.  
Live end-to-end production activation remains **conditional** on (a) implementing/deploying Stage 04K in the Customer App (`tashflow/Palm-Metric`), (b) running live Firebase Emulator rule tests in an environment with Java installed, and (c) manually reviewing and publishing `firestore.spark.rules` in Firebase Console.
