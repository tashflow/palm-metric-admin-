# STAGE 04N.3A — PRODUCTION FIRESTORE RULES SECURITY COMPARISON

- **Audit Stage:** `04N.3A — Production Firestore Rules Security Comparison`
- **Mode:** Strictly Read-Only Security Comparison (Zero Code, Rules, Config, or Archive Mutations)
- **Evaluated Workspace:** `/app/applet` (`Palm Metric Admin App` / `Verda Admin`)
- **Firebase Target:** Project `palm-metric-app`, Firestore database `(default)`
- **Date:** `2026-11-27`
- **Final Verdict:** **`FAIL — OWNER-SUPPLIED CANDIDATE CRITICALLY INSECURE; PRODUCTION DEPLOYMENT PROVENANCE UNRESOLVED (NO-GO FOR STAGE 04O)`**

---

## 1. Executive Summary & Provenance Disclaimer

1. **Owner-Supplied Rules Candidate Status:** The five-point Firestore rules snapshot supplied by the owner (`sign_in_provider is string` inside `isAdmin()`, direct customer `/orders` creation, customer updates to own `/orders`, any signed-in read/write on `/admins` and `/mediaAssets`, and missing `/orderRequests` rules) is treated strictly as an **OWNER-SUPPLIED RULES CANDIDATE**. It is **NOT** assumed to be the active production ruleset in `palm-metric-app` because live Firebase Console / Firestore rules inspection is unavailable from this offline workspace.
2. **Security Posture of the Candidate Snapshot:** **CRITICALLY VULNERABLE (Unfit for Production).** It matches pre-Stage-04B legacy rules documented in `/security_spec.md:16-19` and reintroduces full administrative takeover by any signed-in or anonymous Firebase user, direct `/admins` and `/mediaAssets` hijacking, forged `/orders` pricing and tampering, and total failure of the Stage 04L/04N.2.4 `/orderRequests` approval and inventory pipeline.
3. **Stage 04N.2.9A Accessibility:** A workspace search across `/app`, `/tmp`, `/workspace`, `/mnt`, and `/root` returned **`0` files** matching `*04N29A*` or `*04N.2.9A*`. Customer workspace hardened rules evidence for this comparison is therefore sourced directly from the verified Customer Identity B release archive on disk: `/app/applet/palm-metric-stage04n24-customer.zip` (`108` files, SHA-256 `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`).
4. **Workspace Rules Baseline on Disk:**
   - Admin `/app/applet/firestore.rules`: **`388` lines**, `20,068` bytes, SHA-256 `1845bf0aa19da7ace3c1d92fde50a9ecf009ce3139c252e357dfd4369885a474` (**Legacy Stage 04B/04C**; fixes `sign_in_provider is string`, `/admins`, `/mediaAssets`, and `/orders` update, but still allows customer direct `/orders` creation and omits `/orderRequests` + stock fields).
   - Admin `/app/applet/firestore.spark.rules`: **`554` lines**, `33,516` bytes, SHA-256 `b43c958c771bfa3f31f096ad47259670b15e8b5737dbfd6f5a789f269e3ed426` (**Hardened Stage 04L/04N.2.4 Spark target**).
   - Customer Archive `firestore.rules`: **`493` lines**, `32,125` bytes, SHA-256 `ae299eca53afd201328c7480e702619d534e8c41cdfd83e3e5a6a46b2baa260d` (**Stage 04E Blaze Cloud-Function era**; blocks all client `/orders` creation via `allow create: if false`, lacks `/orderRequests`).
   - Customer Archive `firestore.spark.rules`: **`775` lines**, `51,585` bytes, SHA-256 `84a8362baff8fba2e13fcf0d009b8434d7bf03897111c3e6ab1df51e8bb47e3f` (**Hardened Stage 04K/04L/04N.2.2 Spark target**, with cross-app discrepancies documented in Section 4.8).

---

## 2. Candidate Rules Security Findings

| ID | Severity | Candidate Rule Clause / Gap | Exploit Path & Business Impact | Hardened Reference (Admin / Customer Spark Rules) |
|---|---|---|---|---|
| **CAND-01** | **CRITICAL** | `isAdmin()` accepts any authenticated user where `sign_in_provider is string` | Any Firebase user—including an anonymous customer session (`sign_in_provider == 'anonymous'`) or an unverified newly created account—has a string `sign_in_provider`. That caller immediately passes `isAdmin()` and gains full read/write/delete authority across `/menu`, `/categories`, `/billboards`, `/productCustomizations`, `/settings`, `/orders`, `/admins`, and `/mediaAssets`. (`security_spec.md:17` explicitly records this exact historical Stage 04B vulnerability.) | Admin `firestore.spark.rules:44-76`; Customer `firestore.spark.rules:33-61` |
| **CAND-02** | **CRITICAL** | Signed-in users can read & write `/admins` | Even if `isAdmin()` were patched separately, any authenticated customer can execute `create` / `set` on `/admins/{request.auth.uid}` (or overwrite/delete legitimate admin docs), permanently escalating themselves to Admin (`exists(/admins/$(uid))`) and harvesting admin email/PII. | Admin `firestore.spark.rules:526-532`; Customer `firestore.spark.rules:769-773` (`allow create, update, delete: if false;`) |
| **CAND-03** | **CRITICAL** | Signed-in users can read & write `/mediaAssets` | Any customer or anonymous user can overwrite, delete, or inject malicious/defacing payloads into `/mediaAssets` (and chunks), poisoning storefront menu photography and promotional billboards or exhausting Firestore document storage. | Admin `firestore.spark.rules:384-402, 535-551`; Customer `firestore.spark.rules:672-682` (note Customer lacks `isValidMediaAsset`) |
| **CAND-04** | **CRITICAL** | Customer direct `/orders` creation allowed | Customers bypass `/orderRequests`, authoritative catalog price lookup (`verifyAndPriceOrderRequest`), stock checks, customization bounds, pickup-only/SAR constraints, and audit logging—enabling forged orders at `0.01 SAR`, negative/arbitrary totals, or fake `orderNumber` collisions. | Admin `firestore.spark.rules:312-342, 514`; Customer `firestore.spark.rules:468-510, 720` |
| **CAND-05** | **CRITICAL** | No `/orderRequests` rules | Under Firestore's global safety net (`match /{document=**} { allow read, write: if false; }`), the entire Stage 04L/04N.2.4 Customer checkout and Admin approval workflow (`/orderRequests`, nested `/auditLogs`, `/orderNumbers`, `/orderRequestAuditLogs`) breaks with `PERMISSION_DENIED`—or worse, if the candidate lacks a default-deny catch-all, becomes world-readable/writable. | Admin `firestore.spark.rules:223-309, 451-504`; Customer `firestore.spark.rules:298-440, 563-591, 687-708, 753-766` |
| **CAND-06** | **HIGH** | Customer can update their own `/orders` | A customer can mutate `status` (e.g., skipping `Pending` -> `Ready` or `Completed`), alter `items[]`, or lower `totalBill` after an order has been accepted/prepared, destroying fulfillment integrity and accounting records. | Admin `firestore.spark.rules:357-374, 515-516`; Customer `firestore.spark.rules:530-561, 721-722` |
| **CAND-07** | **HIGH** | Missing inventory / atomic transaction integrity & schema validators | Without `isValidPromotedOrderCreate`, `isValidOrderRequestAdminUpdate`, and `stockQuantity`/`stockCount` constraints tied to `runTransaction`, orders cannot atomically decrement stock or guarantee 1:1 `ord_<requestId>` and `PM-XXXXXX` uniqueness. | Admin `firestore.spark.rules:81, 92-93, 295-355`; `src/lib/orderRequests.ts:596-942` |

---

## 3. Side-by-Side Security Comparison Matrix

| Security Control | Owner-Supplied Candidate | Admin `firestore.rules` (Legacy `388` lines) | Admin `firestore.spark.rules` (Hardened `554` lines) | Customer `firestore.rules` (`493` lines) | Customer `firestore.spark.rules` (`775` lines) |
|---|---|---|---|---|---|
| **Global Default-Deny** | Unspecified (if missing, total compromise) | **YES** (`lines 5-7`) | **YES** (`lines 23-25`) | **YES** (`lines 6-8`) | **YES** (`lines 10-12`) |
| **Anonymous User Exclusion in `isAdmin()`** | **FAIL** (`sign_in_provider is string` matches `'anonymous'`) | **PASS** (`isVerified()` lines `26-31` requires `google.com` or `email_verified`) | **PASS** (`isNonAnonymousUser()` lines `44-49` rejects `'anonymous'`) | **PASS** (`line 31`: `sign_in_provider != 'anonymous'`) | **PASS** (`line 35`: `sign_in_provider != 'anonymous'`) |
| **Admin Allowlist (UIDs & Emails)** | Broken (any provider passes) | **PARTIAL/STALE** (`1` UID, `2` emails, lines `35-41`) | **ALIGNED** (`2` UIDs, `4` emails, lines `53-64`, matches `adminAllowlist.ts:1-11`) | **PARTIAL** (`1` UID `39H...` only, `4` emails without `.lower()`, lines `35-43`) | **ALIGNED** (`2` UIDs, `4` emails with `.lower()`, lines `41-48`) |
| **Direct Customer `/orders` Create** | **VULNERABLE** (allowed) | **VULNERABLE** (allowed, lines `321-327`; also blocks Stage 04L promoted fields at `line 109`) | **BLOCKED** (`isAdmin() && isValidPromotedOrderCreate`, `lines 312-342, 514`) | **BLOCKED** (`allow create: if false;`, `line 454` — Blaze Cloud Function only) | **BLOCKED for Customers** (`isAdmin() && isValidAdminOrderCreate`, `line 720`; `sourceRequestId` optional!) |
| **Customer `/orders` Update** | **VULNERABLE** (own orders updatable) | **BLOCKED** (`isAdmin()` + `affectedKeys().hasOnly(['status', 'updatedAt'])`, `lines 328-335`) | **BLOCKED** (`isAdmin()` + `isValidOrderUpdate` + `affectedKeys().hasOnly(['status', 'updatedAt'])`, `lines 357-374, 515-516`) | **BLOCKED** (`isAdmin()` + `affectedKeys().hasOnly(['status', 'updatedAt'])`, `lines 455-456`) | **BLOCKED** (`isAdmin()` + `affectedKeys().hasOnly(['status', 'updatedAt'])`, `lines 721-722`) |
| **`/admins` Access** | **VULNERABLE** (any signed-in read/write) | **HARDENED** (writes restricted to `isBootstrappedAdmin()`, `lines 340-355`) | **PARTIAL/ASYMMETRIC** (`isVerifiedAdminToken()` can write, `lines 526-532`; contradicts `AdminAccessModal.tsx:64`) | **LOCKED** (`allow create, update, delete: if false;`, `line 490`) | **LOCKED** (`allow create, update, delete: if false;`, `line 772`) |
| **`/mediaAssets` Access** | **VULNERABLE** (any signed-in read/write) | **HARDENED** (`isPublic` gate, `isAdmin()` create/delete, immutable update, `lines 358-385`) | **HARDENED** (`isPublic` gate, `isAdmin()` create/delete, `update: if false`, `lines 535-551`) | **PARTIAL** (`allow get: if isValidId` leaks non-public `mediaAssets`; `isAdmin()` can `update`, `lines 432-442`) | **PARTIAL** (`allow get: if isValidId` leaks non-public `mediaAssets`; lacks `isValidMediaAsset`; allows `update`, `lines 672-682`) |
| **`/orderRequests` & Audit Collections** | **ABSENT** | **ABSENT** | **HARDENED** (`lines 223-309, 451-504`; `delete: if false`) | **ABSENT** | **PRESENT** (`lines 298-440, 687-708, 753-766`; allows `isAdmin()` `delete`, `line 696`) |
| **Menu Stock & Pricing Settings** | Legacy / Missing | **INCOMPATIBLE** (rejects `stockQuantity`/`stockCount` at `line 55` and `/settings/pricing` at `line 250`) | **SUPPORTED** (`stockQuantity`/`stockCount` `lines 81, 92-93`; `/settings/pricing` `lines 126-134, 419`) | Missing `pricing`; permissive `menu` `get` (`line 401`) | Supports `stockQuantity`/`stockCount` (`lines 182-183`); **MISSING** `/settings/pricing` (`lines 271-295`) |

---

## 4. Deep-Dive Security Analysis

### 4.1 Privilege Escalation Paths
1. **Anonymous-to-Admin Universal Escalation (Candidate `isAdmin()`):**
   - In Firebase Auth, anonymous authentication (`signInAnonymously()`) populates `request.auth.token.firebase.sign_in_provider == 'anonymous'`—which evaluates `is string` to `true`.
   - Under the candidate `isAdmin()`, any visitor opening the Customer App immediately satisfies `isAdmin()` and can overwrite menu prices to `0`, toggle all items out of stock, rewrite promotional billboards, or read/delete every customer's PII in `/orders`.
   - Both Admin `firestore.rules:26-44` (legacy Stage 04B fix) and `firestore.spark.rules:44-76` (Stage 04L/04N.2.4) eliminate `sign_in_provider is string`. `firestore.spark.rules:44-49` explicitly rejects `'anonymous'` in `isNonAnonymousUser()`.
2. **Self-Service `/admins` Registry Escalation (Candidate `/admins` Read/Write):**
   - Allowing any signed-in user to write `/admins/{uid}` creates a persistent backdoor: writing an arbitrary document at `/admins/<attackerUid>` satisfies `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` in both `firestore.rules:48` and `firestore.spark.rules:74` (provided `email_verified == true` on an attacker's free Gmail account).
3. **Unchecked UID Fallback vs `email_verified` Caveat in Hardened Rules:**
   - Note that in Admin `firestore.spark.rules:53` and Customer `firestore.spark.rules:48`, the two hardcoded owner UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) bypass the `email_verified == true` branch so owners are never locked out (`security_spec.md:19`), while email allowlist checks (`lines 55-64` and `lines 38-47`) strictly enforce `request.auth.token.email_verified == true && request.auth.token.email.lower() in [...]`.
   - In `firestore.spark.rules:70-75` (`isAdmin()`), DB-backed `/admins/{uid}` fallback additionally requires `isNonAnonymousUser()` AND `request.auth.token.email_verified == true`, blocking anonymous accounts even if an `/admins/{uid}` record existed.
   - However, in Admin `firestore.spark.rules:529-531`, `/admins/{adminUid}` still permits `isVerifiedAdminToken()` to create/update/delete `/admins` docs, whereas `src/components/AdminAccessModal.tsx:64` explicitly informs operators that client-side `/admins` mutations are disabled (matching Customer `firestore.spark.rules:772`: `allow create, update, delete: if false;`).

### 4.2 Admin Allowlist Enforcement
- **Canonical Allowlist (`src/lib/adminAllowlist.ts:1-11`):**
  - **2 UIDs:** `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`.
  - **4 Emails:** `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`.
- **Candidate Snapshot:** Enforces **zero** allowlist (`sign_in_provider is string` admits everyone).
- **Admin `firestore.rules:33-44`:** Enforces only **1 UID** (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`) and **2 emails** (`tashflow26@gmail.com`, `palmmetric1@gmail.com`), locking out the second owner UID (`39H76y4E55g5yX2uY0lE5bQ3a393`) and two allowlisted emails (`palmmatric1@gmail.com`, `tashfilartwork@gmail.com`) unless they are manually seeded in `/admins/{uid}`.
- **Admin `firestore.spark.rules:51-67` & Customer `firestore.spark.rules:33-50`:** Both enforce all **2 UIDs** and all **4 lowercased emails** with `email_verified == true` and non-anonymous provider enforcement.
- **Query-Safe `list` Boundary:** Collection `list` rules (`firestore.spark.rules:407, 416, 427, 436, 445, 456, 490, 498, 512, 528, 537`) check `isVerifiedAdminToken()` (token-only, zero `exists()` reads) rather than `isAdmin()`, because Firestore forbids `exists()` calls inside unconstrained `list` queries. Any dynamic `/admins/{uid}` admin without a bootstrapped token would fail full-collection Admin dashboard listeners unless `isVerifiedAdminToken()` is used—reinforcing why `/admins` client writes should be disabled (`allow create, update, delete: if false`) to match `AdminAccessModal.tsx`.

### 4.3 Customer Direct Order Creation
- **Candidate Snapshot:** Permits customers to write directly to `/orders/{orderId}`. A malicious client can submit `{ totalBill: 0.01, status: 'Completed', items: [...] }`, fabricate a `PM-XXXXXX` number, order out-of-stock or disabled items, or skip `verifyAndPriceOrderRequest()`.
- **Admin `firestore.rules:321-327` (Legacy Hole):** Still allows any `isVerified()` customer to create `/orders/{orderId}` directly as long as `customerUid == request.auth.uid && status == 'Pending'`, with **no** catalog price verification and **no** link to `/orderRequests`. Simultaneously, its `isValidOrder` whitelist (`line 109`) rejects Admin-promoted fields (`subtotal`, `discountTotal`, `taxTotal`, `currency`, `orderType`, `sourceRequestId`, `approvedBy`, etc.) written by `src/lib/orderRequests.ts:748-775`.
- **Admin `firestore.spark.rules:312-342, 514` (Hardened):** Completely blocks customer `/orders` creation. Only `isAdmin() && isValidPromotedOrderCreate(orderId, incoming())` may create `/orders/{orderId}`, strictly enforcing:
  - Deterministic ID `orderId == 'ord_' + data.sourceRequestId` (`line 326`) and `!exists(/orders/$(orderId))` (`line 333`).
  - Existing non-terminal `/orderRequests/$(sourceRequestId)` with matching `customerUid` (`lines 334-336`).
  - Atomic post-commit state (`getAfter`) requiring the source request to transition to `status == 'order_created'` with `approvedOrderId == orderId` (`lines 337-338`) and an atomic `/orderNumbers/$(orderNumber)` claim (`lines 339-341`).
- **Customer `firestore.spark.rules:468-510, 720`:** Blocks customers from `/orders` creation (`isAdmin() && isValidAdminOrderCreate`), **but** treats `sourceRequestId` as optional (`!('sourceRequestId' in data) || ...` at `line 496`). Admin `firestore.spark.rules:325-338` is materially stronger because `sourceRequestId` is mandatory.

### 4.4 Customer Order Mutation
- **Candidate Snapshot:** Permits customers to update their own `/orders` documents—allowing post-submission price tampering, item substitution, `customerUid` reassignment, or unauthorized `status` transitions (`Pending` -> `Ready` / `Completed`).
- **Hardened Rules (`Admin firestore.spark.rules:357-374, 515-516`; `Customer firestore.spark.rules:530-561, 721-722`; `Admin firestore.rules:328-335`):** Customers have **zero** `update` or `delete` permission on `/orders`. Only `isAdmin()` may update `/orders/{orderId}`, restricted via `incoming().diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt'])`, immutable `orderNumber`, `customerUid`, `items`, `totalBill`, `subtotal`, `currency`, `orderType`, `sourceRequestId`, `createdAt`, `updatedAt == request.time`, and enum `status in ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']`.

### 4.5 `/admins` and `/mediaAssets` Access
- **`/admins/{adminUid}`:**
  - **Candidate:** World-readable/writable by any signed-in user (privilege escalation + PII disclosure).
  - **Admin `firestore.spark.rules:526-532`:** `get` restricted to self (`request.auth.uid == adminUid`) or `isAdmin()`; `list` restricted to `isVerifiedAdminToken()`; `create/update/delete` restricted to `isVerifiedAdminToken()` with `isValidAdminUser`.
  - **Customer `firestore.spark.rules:769-773` & `AdminAccessModal.tsx:64`:** Locks `allow create, update, delete: if false;`—matching the app's fail-closed security architecture where admin membership is code-allowlisted rather than client-editable.
- **`/mediaAssets/{assetId}` & `/chunks/{chunkId}`:**
  - **Candidate:** Any signed-in user can read/write/overwrite/delete media assets.
  - **Admin `firestore.spark.rules:384-402, 535-551`:** Enforces `isPublic == true || isAdmin()` on `get`/`list` and chunk `get`, `allow list: if false` on chunks, `isAdmin()` on `create`/`delete` with `isValidMediaAsset` (`<= 800,000` chars/doc, `<= 40` chunks, `totalBytes <= 16 MB`, `createdBy == request.auth.uid`), and `allow update: if false` (immutable assets).
  - **Customer `firestore.spark.rules:672-682` (Weaker):** Omits `isPublic` guard on single-doc `get` (`allow get: if isValidId(assetId)`), lacks `isValidMediaAsset`/`isValidMediaChunk` schema/size bounds, and allows `isAdmin()` `update` on assets and chunks.

### 4.6 `/orderRequests` Ownership & Approval Protections
- **Candidate Snapshot:** Completely omits `/orderRequests` (and nested `/auditLogs`, `/orderNumbers`, `/orderRequestAuditLogs`).
- **Hardened Architecture (`Admin firestore.spark.rules:223-309, 451-504`; `src/lib/orderRequests.ts`):**
  1. **Customer Creation (`isValidOrderRequestCreate`, `lines 223-250`):** Signed-in customers may create only with `customerUid == request.auth.uid`, `status == 'pending_review'`, `reviewStatus == 'unreviewed'`, `requestReference` matching `^REQ-[a-zA-Z0-9_\-]+$`, `orderType`/`pickupType == 'pickup'`, `currency == 'SAR'`, `items` `1..50`, and `createdAt == updatedAt == request.time`.
  2. **Customer PII Isolation (`lines 452-457`):** Customers can `get`/`list` **only** where `customerUid == request.auth.uid`; customers have **zero** `update` or `delete` permissions (`allow delete: if false;` at `line 460`).
  3. **Admin-Only Transitions & Immutable Customer Payload (`isValidOrderRequestAdminUpdate`, `lines 258-309`):** Enforces `isAllowedRequestStatusTransition` (`pending_review -> reviewing | verified | rejected | order_created`, `reviewing -> verified | rejected | order_created`, `verified -> rejected | order_created`), forbids transitions out of terminal `order_created` or `rejected`, and pins `customerUid`, `customerName`, `customerContact`, `requestReference`, `items`, `notes`, `orderNote`, `pickupType`, `orderType`, `currency`, and `createdAt` to `existing()`.
  4. **Mandatory Rejection Reason (`lines 285-292`):** Rejecting (`status == 'rejected'`) requires `rejectionReason` (`3..300` chars), `rejectedBy == request.auth.uid`, `rejectedAt == request.time`, and forbids `approvedOrderId`.
  5. **Atomic 1:1 Promotion & Audit Logs (`lines 295-307, 463-504`):** Transitioning to `order_created` requires `approvedOrderId == 'ord_' + requestId`, `approvedOrderNumber`, `approvedBy == request.auth.uid`, `approvedAt == request.time`, `verifiedPricing` (`SAR`), and `existsAfter`/`getAfter` confirmation that `/orders/ord_<requestId>` exists with matching `sourceRequestId` and `orderNumber`. Nested `/orderRequests/{requestId}/auditLogs/{logId}` (`lines 463-484`) and flat `/orderRequestAuditLogs/{auditId}` (`lines 496-504`) are strictly `isAdmin()` append-only (`allow update, delete: if false;`).

### 4.7 Inventory Update Authorization & Transaction Integrity
- **How Inventory Deduction Works (`src/lib/orderRequests.ts:683-689, 828-855` & `src/lib/authoritativePricing.ts:216-236, 669-717`):**
  - Inside `runTransaction`, `approveAndPromoteOrderRequest()` reads `/menu/{itemId}` docs, verifies `isMenuItemAvailableForOrder()` and `totalQtyForProduct <= availableStockNum`, computes `computeStockDeductionPlans()`, and atomically decrements `stockQuantity` / `stockCount` (flipping `inStock: false` and `outOfStock: true` / `isAvailable: false` / `available: false` when remaining stock hits `0`).
- **Impact Under Candidate Snapshot & Legacy `firestore.rules`:**
  - Under the **Candidate Snapshot**, any anonymous user can falsify `/menu` stock directly (`CAND-01`), while direct `/orders` creation skips stock validation completely (`CAND-04`).
  - Under **Admin `firestore.rules:55`**, `stockQuantity`, `stockCount`, `isAvailable`, `available`, and `outOfStock` are omitted from `isValidMenuItem`'s `hasOnly(...)` list—meaning Admin's atomic `runTransaction` promotion **fails with `PERMISSION_DENIED`** whenever an item carries numeric stock!
  - Under **Admin `firestore.spark.rules:81, 89-93`**, those fields are explicitly permitted and type/range-validated (`0..100000`), and only `isAdmin()` may update `/menu/{itemId}` (`line 429`).
- **Residual Transaction Gaps in Hardened Spark Rules:**
  - Because `firestore.spark.rules:429` allows any `isAdmin()` `/menu` update that satisfies `isValidMenuItem`, Firestore Rules themselves cannot force every Admin `/orders` promotion of a stock-tracked item to invoke `getAfter(/menu/$(itemId))` decrement checks (since `items[]` length is dynamic up to 50). Stock deduction integrity therefore depends on Admin transaction execution (`approveAndPromoteOrderRequest`), enforced by unit and mock-transaction tests rather than rules-level cross-doc stock arithmetic.

### 4.8 Missing Validation, Spark Limitations & Cross-App Inconsistencies

#### A. Spark Architectural Limitation (Both Admin & Customer `firestore.spark.rules`)
- As documented in `firestore.spark.rules:16-19`, Firestore Security Rules **cannot loop over dynamic arrays (`items[]`)** to fetch every `/menu/{itemId}` and `/productCustomizations/{itemId}` document and recompute `totalBill` server-side.
- Consequently:
  1. Only `data.items[0]` is type-checked in rules (`firestore.spark.rules:240, 318`; Customer `firestore.spark.rules:348, 482`); elements `items[1..49]` are not element-validated by rules.
  2. Authoritative SAR pricing (`verifyAndPriceOrderRequest`) runs inside the **verified Admin client `runTransaction`** rather than a server-side Cloud Function. Moving to Blaze Cloud Functions remains the long-term server-authoritative pricing target.

#### B. Cross-App & Rules-File Inconsistencies Requiring Convergence
1. **Shared `palm-metric-app` Collection Coverage Mismatch (`Admin` vs `Customer` `firestore.spark.rules`):**
   - Customer `firestore.spark.rules:732-750` defines `/reports/{reportId}` (Customer feedback/signup reports) and `/fcmTokens/{tokenId}` (push notification tokens); **Admin `firestore.spark.rules` omits both** (falling back to global deny). Deploying Admin's file alone to `palm-metric-app` would break Customer `/reports` and `/fcmTokens`.
   - Conversely, Admin `firestore.spark.rules:126-134, 419` defines `/settings/pricing` (`taxEnabled`, `taxRatePercent`, `discountEnabled`, `discountType`, `discountValue`, `discountLabel`); **Customer `firestore.spark.rules:271-295, 664-669` omits `/settings/pricing` fields**, which would break Admin pricing configuration updates if Customer's file were deployed.
2. **Order Request Schema Divergence (`requestSource` & `approvedOrderId`):**
   - Customer `firestore.spark.rules:350` strictly requires `data.requestSource == 'customer-app-spark'` and `orderNote.size() <= 220` (`line 346`), whereas Admin `src/lib/orderRequests.ts:1258` emits `requestSource: 'palm-metric-customer-preview'` and Admin `firestore.spark.rules:243-244` allows `300`-char `notes`/`orderNote`.
   - Admin `firestore.spark.rules:297` enforces `approvedOrderId == 'ord_' + requestId` on `/orderRequests` updates, while Customer `firestore.spark.rules:420-425` allows any valid ID for `approvedOrderId` and checks `getAfter(/orders/...).data.totalBill == data.verifiedTotalSar` (a check missing from Admin `firestore.spark.rules:301-307`!).
   - Admin `firestore.spark.rules:460` forbids deleting `/orderRequests` (`allow delete: if false;`), whereas Customer `firestore.spark.rules:696` permits `isAdmin()` delete (`allow delete: if isValidId(requestId) && isAdmin()`).
   - Admin `firestore.spark.rules:323` permits `paymentStatus in ['unpaid', 'pending', 'paid', 'pay_at_pickup']` (matching `firebase-blueprint.json:244`), whereas Customer `firestore.spark.rules:493, 558` restricts `paymentStatus` to `['unpaid', 'paid']`.
3. **`/admins` Mutability vs UI Policy:**
   - Admin `firestore.spark.rules:529-531` permits `isVerifiedAdminToken()` writes to `/admins/{adminUid}`, contradicting `src/components/AdminAccessModal.tsx:64` and Customer `firestore.spark.rules:772` (`allow create, update, delete: if false;`).
4. **Public `get` & Catalog Validator Asymmetry:**
   - Customer `firestore.spark.rules:633, 641, 657, 665, 673, 678` uses open `allow get: if isValidId(...)`, allowing direct ID lookups of out-of-stock `/menu`, inactive `/billboards`, disabled `/productCustomizations`, private `/settings`, and non-public `/mediaAssets` + `/chunks`. Admin `firestore.spark.rules:406, 415, 426, 435, 444, 536, 544` gates `get` properly (`inStock == true`, `isActive == true`, `enabled == true`, `isPublic == true`, or `isAdmin()`).
   - Customer `firestore.spark.rules:163-173` allows `700,000`-char base64 `imageUrl` values and `1,000,000` max stock, whereas Admin `firestore.spark.rules:85, 92-94` caps `imageUrl` at `2,048` chars and stock at `100,000`.
5. **Admin Update `affectedKeys()` Drop & Status Enum Mismatch:**
   - Admin `firestore.spark.rules:409, 429, 438` dropped `.diff(existing()).affectedKeys().hasOnly(...)` guards that existed on `/categories`, `/menu`, and `/billboards` in legacy `firestore.rules:240, 277, 297` (preserving `affectedKeys()` only on `/orders` `line 516`).
   - Admin `firestore.spark.rules:259` `isValidOrderRequestAdminUpdate` accepts `prev.status` `'under_review'` (no `'in_review'`), whereas `isAllowedRequestStatusTransition` (`line 254`) accepts `'reviewing'`, `'under_review'`, `'in_review'`; `'in_review'` docs would fail the `prev.status` guard at `line 259`.
   - Admin `firestore.spark.rules:419` validates `isValidPricingSettings(incoming())` without requiring `updatedAt == request.time`.
6. **Stale Active File & UI Copy Helper:**
   - `/app/applet/firestore.rules` (legacy `388` lines) and `/app/applet/src/lib/firestoreRulesText.ts` (`FIRESTORE_RULES_TEXT`) are completely out of sync with `firestore.spark.rules` and with live `src/lib/orderRequests.ts` code.

---

## 5. Unresolved Deployment Provenance

- **Live Production State Is `UNRESOLVED`:**
  1. Neither `firebase.json` nor `.firebaserc` nor `.git` exists in `/app/applet`.
  2. `.github/workflows/deploy.yml` deploys static Vite output to GitHub Pages only and never deploys Firestore rules.
  3. No live Firebase Console export or `firebase` CLI rules fetch from project `palm-metric-app` (`(default)`) was performed or available in this read-only offline container.
- **Conclusion:** It is **unknown and unproven** whether the live production Firestore instance for `palm-metric-app` currently runs:
  - (a) the **owner-supplied candidate snapshot** (catastrophic risk if true),
  - (b) legacy Admin `firestore.rules` (Stage 04B/04C — blocks `/orderRequests` and allows direct `/orders`),
  - (c) Customer `firestore.rules` (Stage 04E — blocks all client `/orders` writes), or
  - (d) a version of `firestore.spark.rules`.
- **Mandatory Verification Gate:** Before any application release or Stage 04O cutover, the owner/operator must inspect the **actual active Rules tab in Firebase Console -> Firestore Database -> Rules** for project `palm-metric-app` (`(default)`).

---

## 6. Required Remediation Plan (Pre-Deploy / Pre-Stage 04O)

Execute in order (not executed in this read-only audit):

1. **Immediate Live Production Triage (Firebase Console):**
   - Inspect live deployed rules in `palm-metric-app` `(default)` immediately. If the owner-supplied candidate snapshot (`sign_in_provider is string`, open `/admins`, open `/mediaAssets`, direct customer `/orders`) is actually live, treat it as an active **P0 security emergency** and replace it immediately.
2. **Converge One Single Canonical Shared Ruleset Across Both Apps:**
   - Merge the superset of hardened controls from **Admin `firestore.spark.rules`** and **Customer `firestore.spark.rules`** into one identical canonical `firestore.rules` in both Customer and Admin repositories:
     - Keep Admin's `isNonAnonymousUser()`, `isVerifiedAdminToken()`, strict single-doc `get` gates (`inStock`, `isActive`, `enabled`, `isPublic`, `/settings/coffeeOptions`), `allow update: if false` + `isValidMediaAsset` on `/mediaAssets`, mandatory `sourceRequestId` + `'ord_' + requestId` on `/orders`, `allow delete: if false` on `/orderRequests`, `/settings/pricing` validation (adding `updatedAt == request.time`), and `paymentStatus` enum `['unpaid', 'pending', 'paid', 'pay_at_pickup']`.
     - Incorporate Customer's `/reports` and `/fcmTokens` blocks (`Customer firestore.spark.rules:732-750`) and the cross-doc `getAfter(/orders/$(data.approvedOrderId)).data.totalBill == data.verifiedTotalSar` + `customerUid == existing().customerUid` invariants (`Customer firestore.spark.rules:422-424`).
     - Lock `/admins/{adminUid}` writes (`allow create, update, delete: if false;`) to match `AdminAccessModal.tsx:64` and Customer `firestore.spark.rules:772`.
     - Align `requestSource` (`'customer-app-spark'` vs `'palm-metric-customer-preview'`), `in_review` in `prev.status`, and restore `.diff(existing()).affectedKeys().hasOnly(...)` guards on `/categories`, `/menu`, `/billboards`.
3. **Sync UI Fallback & Firebase Config:**
   - Update `/app/applet/firestore.rules` and `/app/applet/src/lib/firestoreRulesText.ts` to match the single converged ruleset byte-for-byte, and add an explicit `firebase.json` (`"firestore": { "rules": "firestore.rules" }`) so CLI/emulator/deploy tooling always targets the exact same file.
4. **Java 17+ Emulator Adversarial Test Gate (`NO-GO` Until Passed):**
   - On a Java 17+ host, replace stubbed rules assertions in `scripts/stage04n.test.ts` with real `@firebase/rules-unit-testing` tests covering every exploit vector in Section 2 (anonymous `isAdmin()`, `/admins` self-write, `/mediaAssets` tamper, direct `/orders` create/update, cross-user PII `get`/`list`, invalid `/orderRequests` promotions, `PM-XXXXXX` claim replay, `/reports`, `/fcmTokens`) before deploying to `palm-metric-app`.
5. **Long-Term Blaze Upgrade Track:**
   - Once on Firebase Blaze, migrate order promotion and pricing/stock calculation to a server-side Cloud Function (`allow create: if false` on `/orders`) so `items[]` validation and catalog price summation no longer depend on Spark client transactions.

---

## 7. Exact Files Modified

- **Source, Rules, Config, Dependency, Lockfile, and Archive Files Modified:** **`ZERO (0)`**
- **Report File Created:** `/STAGE_04N3A_PRODUCTION_RULES_SECURITY_COMPARISON.md`

---

## 8. Final Verdict

### **`FAIL — CANDIDATE RULESET CRITICALLY INSECURE; DEPLOYMENT PROVENANCE UNRESOLVED`**

- **Owner-Supplied Rules Candidate:** **REJECTED (`CRITICAL` FAIL)** — introduces universal anonymous/customer Admin privilege escalation, open `/admins` and `/mediaAssets` read/write takeover, unverified direct `/orders` creation and mutation, and breaks Stage 04L/04N.2.4 `/orderRequests` + atomic stock deductions.
- **Production Deployment Provenance:** **UNRESOLVED** (`firebase.json` absent; live `palm-metric-app` rules unverified without Firebase Console access).
- **Stage 04O Readiness:** **`NO-GO`** until live `palm-metric-app` rules are verified, a single converged ruleset (`Admin` + `Customer` Spark controls) replaces legacy `firestore.rules` / `FIRESTORE_RULES_TEXT`, and `@firebase/rules-unit-testing` passes on a Java 17+ environment.
