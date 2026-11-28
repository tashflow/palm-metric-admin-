# STAGE 04N.2.7C — PALM METRIC ADMIN IDENTITY B VERIFICATION REPORT

- **Audit Stage:** `04N.2.7C — Palm Metric Admin Identity B Verification`
- **Confirmed Workspace Root:** `/app/applet`
- **Confirmed Application:** Palm Metric Admin App (`Verda Admin — Specialty Coffee & Food Management`)
- **Firebase Target:** Project `palm-metric-app`, Firestore database `(default)`
- **Timestamp:** `2026-11-27T21:27:20-08:00`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**
- **Stage 04O Readiness Recommendation:** **`NOT SAFE TO BEGIN STAGE 04O YET (NO-GO)`** — Hold Stage 04O until (1) active `firestore.rules` is reconciled with `firestore.spark.rules`, (2) live Firestore Emulator tests run on a Java 17+ host, and (3) Identity A / standalone Customer App parity (`Stage 04N.2.6`) are formally resolved or closed.

---

## 1. Workspace Identity Evidence

Direct inspection of `/app/applet` re-verified Admin App identity:
- `/app/applet/metadata.json`: `"name": "Verda Admin — Specialty Coffee & Food Management"`
- `/app/applet/index.html`: `<html lang="ar" dir="rtl">`, `<title>بالم مترك — لوحة إدارة القهوة المختصة والمخبوزات | Palm Metric</title>`, `og:title: "Palm Metric — Specialty Coffee & Food Admin"`, entry `/src/main.tsx`
- `/app/applet/package.json`: `"name": "react-example"`, scripts `dev`, `build`, `preview`, `clean`, `lint` (`tsc --noEmit`), `test` (`tsx --test scripts/*.test.ts`); omits Customer-only packages (`@vis.gl/react-google-maps`, `adm-zip`)
- `/app/applet/src/App.tsx`: `AdminDashboard` with `AdminTab` routes (`'requests' | 'orders' | 'menu' | 'billboard' | 'customer'`), gated behind `authLoading || !user || !isAdmin`
- `/app/applet/firebase-applet-config.json`: `projectId: "palm-metric-app"`, `firestoreDatabaseId: "(default)"`, `appId: "1:522581928710:web:993ecee99d938707fc8c87"`

---

## 2. Identity B Archive Hash, Size & File Count

Recalculated directly on `/app/applet/palm-metric-stage04n24-admin.zip` without modifying the archive:

| Property | Expected (Identity B) | Verified Measured Value | Match |
|---|---:|---:|---|
| Exact Path | `/app/applet/palm-metric-stage04n24-admin.zip` | `/app/applet/palm-metric-stage04n24-admin.zip` | **EXACT MATCH** |
| File Count (non-dir) | `112` | `112` | **EXACT MATCH** |
| Byte Size | `1,927,570` bytes | `1,927,570` bytes | **EXACT MATCH** |
| SHA-256 | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **EXACT MATCH** |

---

## 3. Exact Archive-to-Workspace Comparison Results

Extracted `/app/applet/palm-metric-stage04n24-admin.zip` into temporary directory `/tmp/stage04n27c_idb` (subsequently removed) and compared SHA-256 checksums of all `112` extracted files against `/app/applet` (excluding `node_modules/`, `dist/`, `.git/`, `.aistudio/`, `*.zip`, and `package-lock.json`):

- **Extracted File Count:** `112`
- **Workspace Compared File Count:** `144`
- **Byte-for-Byte Identical Files:** **`112 / 112`**
- **Differing Files:** **`0` (`[]`)**
- **Missing Files (in Archive, missing in Workspace):** **`0` (`[]`)**
- **Extra Files (in Workspace only, `32` total):** Strictly post-archive audit/verification deliverables (`STAGE_04N24_*` [8], `STAGE_04N25_*` [7], `STAGE_04N26_*` [7], `STAGE_04N27_*` [8], `STAGE_04N27A_*` [1], `STAGE_04N27B_*` [1]).

All application source files, test scripts, `firestore.rules`, `firestore.spark.rules`, `firebase-blueprint.json`, `firebase-applet-config.json`, and `package.json` in `/app/applet` match **Identity B** `100%` byte-for-byte.

---

## 4. Identity A Unresolved Status

- **Expected Identity A:** `palm-metric-stage04n24-admin.zip`, `64` files, `1,844,172` bytes, SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f`
- **Status:** **`UNRESOLVED — NOT FOUND ON DISK`**
- Identity B (`be072ce3...`, `112` files) is **NOT** identical to Identity A (`c00e9e4c...`, `64` files). No claim of equivalence is made.

---

## 5. Admin Source & Configuration Security Audit Findings

### 5.1 Firebase Initialization & Target Project
- `/app/applet/firebase-applet-config.json:1-10` & `/app/applet/src/lib/firebase.ts:30-46`: Targets `projectId: 'palm-metric-app'`, `firestoreDatabaseId: '(default)'`, `authDomain: 'palm-metric-app.firebaseapp.com'`, `storageBucket: 'palm-metric-app.firebasestorage.app'`, `appId: '1:522581928710:web:993ecee99d938707fc8c87'`.
- Observation: `src/lib/firebase.ts:41` calls `getFirestore(app)` (resolving to `(default)` database) rather than reading `firebase-applet-config.json` dynamically via `getFirestore(app, config.firestoreDatabaseId)`. Functional for `(default)`, noted for multi-DB hygiene.

### 5.2 Admin Authentication & Allowlist Enforcement
- `/app/applet/src/lib/adminAllowlist.ts:1-54`:
  - `BOOTSTRAPPED_ADMIN_EMAILS`: `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`
  - `BOOTSTRAPPED_ADMIN_UIDS`: `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`
  - `isVerifiedAdminIdentity()` (`lines 27-53`) blocks `isAnonymous`, requires email verification / Google provider / bootstrapped UID, and rejects non-allowlisted users.
- `/app/applet/src/contexts/AuthContext.tsx:94-185`: Immediately signs out anonymous sessions (`if (currentUser.isAnonymous) await signOut(auth)`), verifies email/claims, checks bootstrapped allowlist or `admins/${uid}` doc before setting `isAdmin = true`.
- `/app/applet/src/App.tsx:95`: Firestore subscriptions (`orderRequests`, `orders`, `menu`, `billboards`, `categories`, `settings`, `productCustomizations`) only attach when `!authLoading && user && isAdmin`.

### 5.3 Order Request Review, Normalization, Approval & Audit Logging
- `/app/applet/src/lib/orderRequests.ts`:
  - `normalizeStatus()` (`lines 111-134`): Maps legacy `'under_review'` and `'in_review'` canonically to `'reviewing'`; `'price_verified'` to `'verified'`; `'approved'`/`'promoted'` to `'order_created'`.
  - `startOrderRequestReview()` (`lines 411-480`): Requires valid Admin UID, rejects terminal states (`'rejected'`, `'order_created'`), transitions to `'reviewing'` with audit log entry `'start_review'`.
  - `verifyOrderRequest()` (`lines 482-587`) & `/app/applet/src/lib/authoritativePricing.ts:127-658`: Recomputes prices in integer **halalas** (`HALALAS_PER_SAR = 100`) exclusively from catalog `/menu`, `/productCustomizations`, `/settings/coffeeOptions`, and `/settings/pricing`—ignoring tampered client `submittedUnitPrice` / `clientEstimatedTotal` while setting both `verifiedPricing.totalSar` and `verifiedPricing.totalBillSar`.
  - `approveAndPromoteOrderRequest()` (`lines 596-942`): Uses deterministic order ID `ord_<sanitizedRequestId>`, replays idempotently if already promoted for the same `(requestId, customerUid)`, allocates unique `PM-XXXXXX` number via `/orderNumbers/{orderNumber}` (`lines 692-716`), creates `/orders/{orderId}` (`status: 'Pending'`, `sourceRequestId`, `requestReference`), updates `/orderRequests/{requestId}` (`status: 'order_created'`), and writes append-only `/orderRequests/{requestId}/auditLogs/{logId}` (`price_verified`, `approve`, `order_promoted`).
  - `rejectOrderRequest()` (`lines 944-1021`): Enforces non-empty trimmed `rejectionReason` (bounded to 300 chars) and blocks later promotion (`ALREADY_REJECTED`).

### 5.4 Inventory Transaction Logic
- `/app/applet/src/lib/authoritativePricing.ts:660-717` (`computeStockDeductionPlans`, `extractManagedNumericStock`) & `/app/applet/src/lib/orderRequests.ts:828-855`: Inside the promotion transaction, verifies `totalQtyForProduct <= availableStock`, decrements `stockQuantity` / `stockCount`, and sets `inStock: false` (plus `outOfStock: true` / `isAvailable: false` / `available: false` if present) when remaining stock reaches `0`. If `stockPlans.length > 0` and `tx.updateMenuDoc` is absent, throws `STOCK_DEDUCTION_UNSUPPORTED`.

### 5.5 Firestore Security Rules — **CRITICAL DEPLOYMENT GAP DETECTED**
Inspection of both rules files on disk revealed a critical divergence:
1. **`/app/applet/firestore.spark.rules` (554 lines — Target Hardened Stage 04L / 04N.2.4 Rules):**
   - `isNonAnonymousUser()` rejects `'anonymous'` provider (`lines 44-49`).
   - `isVerifiedAdminToken()` matches both Admin UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and all 4 canonical Admin emails (`lines 51-67`).
   - `isValidMenuItem()` allows `stockQuantity`, `stockCount`, `isAvailable`, `available`, `outOfStock` (`line 81`).
   - `/orderRequests/{requestId}` (`lines 451-485`) restricts reads to owner/Admin, enforces `status == 'pending_review'` on customer create, restricts updates to Admin via `isAllowedRequestStatusTransition` (`reviewing`, `verified`, `rejected`, `order_created`) + `existsAfter`/`getAfter` cross-document invariants, and forbids deletes.
   - `/orderRequests/{requestId}/auditLogs/{logId}` (`lines 463-484`) and `/orderRequestAuditLogs/{auditId}` (`lines 496-504`) are append-only (`allow update, delete: if false`).
   - `/orderNumbers/{orderNumber}` (`lines 488-493`) is Admin-only append-once.
   - `/orders/{orderId}` (`lines 507-518`) blocks direct customer creation (`allow create: if isValidId(orderId) && isAdmin() && isValidPromotedOrderCreate(orderId, incoming())`).
2. **`/app/applet/firestore.rules` (388 lines — Legacy Pre-Stage-04L Rules) & `/app/applet/src/lib/firestoreRulesText.ts`:**
   - **HIGH-RISK FINDING:** `firestore.rules` is **NOT** updated to `firestore.spark.rules` (see header note `firestore.spark.rules:5`: `NOTE: Kept separate from production firestore.rules. Do NOT auto-deploy.`).
   - Specifically, `firestore.rules` currently:
     - **Missing** `/orderRequests/{requestId}`, `/auditLogs/{logId}`, `/orderNumbers/{orderNumber}`, and `/orderRequestAuditLogs/{auditId}` (any non-Admin write/read on `/orderRequests` falls through to default-deny or fails contract if `firestore.rules` is active in Firebase).
     - **Allows direct customer `/orders` creation** (`firestore.rules:321-327`: `allow create: if isVerified() && ... incoming().customerUid == request.auth.uid && incoming().status == 'Pending'`) bypassing `/orderRequests` verification.
     - **Missing** second Admin UID (`39H76y4E55g5yX2uY0lE5bQ3a393`), emails (`palmmatric1@gmail.com`, `tashfilartwork@gmail.com`), and `stockQuantity`/`stockCount` on `isValidMenuItem()`.
   - Because `firebase.json` is not present and we are strictly read-only, we did not alter either rules file; however, `firestore.spark.rules` must replace `firestore.rules` before production cutover.

### 5.6 Customer / Admin Separation
- External storefront domain `https://tashflow.github.io/Palm-Metric/` (`src/types/index.ts:72-73`) is kept separate.
- Internal `/app/applet/src/components/CustomerStorefrontPreview.tsx:412` submits test requests via `createCustomerOrderRequest()` (`src/lib/orderRequests.ts:1212-1270`, `sourceApp: 'palm-metric-customer-preview'`) only when logged in as a verified Admin inside the `customer` preview tab.

---

## 6. Available Verification Commands & Exact Results

Executed strictly using pre-installed `/app/applet/node_modules` dependencies:

| Check | Exact Command | Exit Code | Exact Observed Output Summary |
|---|---|---:|---|
| TypeScript | `npx tsc --noEmit` | `0` | Zero TypeScript errors |
| Lint | `npm run lint` | `0` | Executes `tsc --noEmit`; zero errors |
| Production Build | `npm run build` | `0` | `vite v8.3.8`: `1712 modules transformed`, built in `1.22s` (`dist/index.html` 1.64 kB, `index-*.js` 1,475.51 kB, CSS 40.50 kB, image 754.07 kB) |
| Configured Test Suite | `npm test` | `0` | `tsx --test scripts/*.test.ts`: **72 / 72 passed** (`0` failed, `0` skipped, `1928.69ms`) |
| Colocated Lib Suite | `npx tsx --test src/lib/productCustomizations.test.ts` | `0` | **10 / 10 passed** (`0` failed, `0` skipped, `208.15ms`) *(not matched by `npm test` glob)* |

---

## 7. Genuine Tests vs Mock Transaction Tests vs Static Assertions vs Stubs

Total assertions run across all 4 suites = **`82` (`72` + `10`)**, audited individually from source:

| Test File | Total | Genuine Executed Unit Tests | Mock Transaction Integration Tests | Static Source / Rules / Config Assertions | Constant / Stubbed / Non-Verifying Assertions |
|---|---:|---:|---:|---:|---:|
| `scripts/stage04l.test.ts` | 19 | **5** (`#03, #04, #07, #10, #21`) | **11** (`#01, #05, #06, #08, #09, #11&12, #13, #14-16, #19*, #22, #23`) | **3** (`#02, #17&18, #20`) | **0** |
| `scripts/stage04m.test.ts` | 10 | **1** (`#02`) | **6** (`#03, #04, #05, #06, #07, #09`) | **3** (`#01, #08, #10`) | **0** |
| `scripts/stage04n.test.ts` | 43 | **9** (`#01, #05, #08, #11, #12, #13, #14, #15, #29`) | **8** (`#04, #21, #22, #26**, #27, #28, #30, #31`) | **0** | **26** (`#02, #03***, #06, #07, #09, #10, #16, #17, #18, #19, #20****, #23, #24, #25, #32–#43`) |
| `src/lib/productCustomizations.test.ts` | 10 | **9** (`#01–#09`) | **0** | **1** (`#10`) | **0** |
| **TOTAL** | **82** | **24** | **25** | **7** | **26** |

Notes on audit nuances:
- `*` `stage04l.test.ts #19` runs a multi-step mock transaction audit log sequence AND statically asserts `/auditLogs` rules in `firestore.spark.rules`.
- `**` `stage04n.test.ts #26` invokes `approveAndPromoteOrderRequest` concurrently on `Stage04NMockStore` (note `Stage04NMockStore` lacks an optimistic mutex unlike `InMemoryTransactionalStore` / `Stage04MMockStore`).
- `***` `stage04n.test.ts #03` evaluates `readerUid === ownerUid || isBootstrappedAdminEmail('tashflow26@gmail.com')`, which only proves an allowlisted admin email returns `true` rather than enforcing customer UID isolation.
- `****` `stage04n.test.ts #20` only inserts into an in-memory `Map` and calls `store.menu.get('item-s')` without executing `verifyOrderRequest` or `approveAndPromoteOrderRequest`.
- **Headline Summary:** **`56` genuine checks** (**`49` genuinely executed unit/mock-tx tests** + **`7` static file/rules/config assertions**) and **`26` constant/stubbed assertions** (`stage04n.test.ts`). Zero live Firestore Emulator tests exist or executed.

---

## 8. Emulator & Java Status

- **Java Check (`which java`):** `NO_JAVA`
- **Firebase CLI (`npx firebase --version`):** `15.36.0`
- **Live Firebase Emulator Verification:** **`BLOCKED (NO_JAVA)`** — `0` Emulator rules or live Firestore transaction tests executed.

---

## 9. Exact Files Modified

- **Source / Configuration / Rules / Dependencies / Archives Modified:** **`ZERO (0)`**
  - *(Note: `npm run build` refreshed generated build artifacts inside `dist/`, and `/tmp/stage04n27c_idb` temporary extraction was cleaned up; zero files in `src/`, `scripts/`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `firebase-*.json`, `firestore*.rules`, or `*.zip` were altered. Only this report `STAGE_04N27C_ADMIN_IDENTITY_B_VERIFICATION_REPORT.md` was created.)*

---

## 10. Final Verdict & Stage 04O Recommendation

- **Final Verdict:** **`PASS WITH LIMITATIONS`**
  - Workspace identity (`/app/applet` = Palm Metric Admin App) is confirmed.
  - Identity B archive (`/app/applet/palm-metric-stage04n24-admin.zip`, `112` files, `1,927,570` bytes, `be072ce3...`) is hash-verified and `112/112` identical to `/app/applet` code/rules/tests.
  - `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `56` genuine unit/mock-tx/static checks pass cleanly.
  - Limitations: **Identity A** (`c00e9e4c...`) remains **NOT FOUND**; **`NO_JAVA`** blocks live Firebase Emulator execution (`BLOCKED`); **`26/43`** tests in `scripts/stage04n.test.ts` are non-runtime stubs; and **`firestore.rules`** on disk still carries pre-Stage-04L rules while Stage 04L/04N.2.4 protections live separately in **`firestore.spark.rules`**.

- **Recommendation on Whether Stage 04O Is Safe to Begin:** **`NO — NOT YET SAFE TO BEGIN STAGE 04O`**
  1. Reconcile and deploy **`firestore.spark.rules` → `firestore.rules`** (and align `src/lib/firestoreRulesText.ts`) so direct customer `/orders` creation is closed and `/orderRequests` + dual-UID/4-email allowlist + stock fields are active.
  2. Execute `firebase emulators:exec --only auth,firestore` against `firestore.spark.rules` in a Java 17+ environment (replacing the `26` stubbed checks in `scripts/stage04n.test.ts` with real Emulator rule assertions).
  3. Formally close Identity A provenance (`c00e9e4c...`) and Customer App workspace verification (`Stage 04N.2.6`).
