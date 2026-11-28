# STAGE 04N.2.8 — ADMIN FIRESTORE RULES & RELEASE PROVENANCE RECONCILIATION

- **Audit Stage:** `04N.2.8 — Admin Firestore Rules & Release Provenance Reconciliation`
- **Mode:** Strictly Read-Only Audit
- **Confirmed Workspace:** `/app/applet` (`Palm Metric Admin App` / `Verda Admin — Specialty Coffee & Food Management`)
- **Firebase Target:** Project `palm-metric-app`, Firestore database `(default)`
- **Timestamp:** `2026-11-27T21:33:10-08:00`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Exact Rules File Selected by Firebase Deployment Configuration

- **Present Firebase / Workflow Configuration in `/app/applet`:**
  - `firebase.json`: **DOES NOT EXIST** anywhere in `/app/applet` (or `/app`, `/tmp`, `/workspace`, `/mnt`, `/root`).
  - `.firebaserc`: **DOES NOT EXIST** anywhere in accessible paths.
  - `.git`: **DOES NOT EXIST** in `/app/applet` or `/app` (no local Git commit history available).
  - `/app/applet/.github/workflows/deploy.yml`: Builds static Vite output (`npm run build`) and deploys `dist/` to **GitHub Pages only**; it performs **zero** Firebase CLI / Firestore Rules deployments.
  - `/app/applet/firebase-applet-config.json`: Identifies target Firebase project **`palm-metric-app`** and Firestore database **`(default)`**.
  - `/app/applet/src/lib/firestoreRulesText.ts` & `/app/applet/src/components/FirestoreRulesNotice.tsx`: Embed `FIRESTORE_RULES_TEXT` for the Admin UI's *"Copy Firestore Rules → Publish in Firebase Console"* fallback notice. Byte-for-byte comparison (`src/lib/productCustomizations.test.ts:219`) confirms `FIRESTORE_RULES_TEXT` equals **`/app/applet/firestore.rules`** — **not** `firestore.spark.rules`.
- **Selected Active Rules File:** **`/app/applet/firestore.rules`** (`20,068` bytes, `387` lines / `388` EOF, SHA-256 `1845bf0aa19da7ace3c1d92fde50a9ecf009ce3139c252e357dfd4369885a474`) is the default rules file referenced by AI Studio Firebase rules deployment tooling and the in-app manual rules notice (`FIRESTORE_RULES_TEXT`).
- **Status of `/app/applet/firestore.spark.rules`:** (`33,516` bytes, `553` lines / `554` EOF, SHA-256 `b43c958c771bfa3f31f096ad47259670b15e8b5737dbfd6f5a789f269e3ed426`) is **NOT** selected for deployment anywhere (`firebase.json` is absent, `FIRESTORE_RULES_TEXT` copies `firestore.rules`, and `firestore.spark.rules:5` explicitly states `NOTE: Kept separate from production firestore.rules. Do NOT auto-deploy.`).

---

## 2. Legacy Versus Hardened Rules Comparison

| Dimension | `/app/applet/firestore.rules` (**Legacy Active File**) | `/app/applet/firestore.spark.rules` (**Hardened Stage 04L / 04N.2.4 File**) |
|---|---|---|
| **Classification** | **Legacy** (Stage 04B/04C era; documented in `security_spec.md` & `src/lib/firestoreRulesText.ts`) | **Hardened Target** (Stage 04L / 04N.2.2 / 04N.2.4 converged Spark rules) |
| **File Size / Lines** | `20,068` bytes / `387` lines | `33,516` bytes / `553` lines |
| **SHA-256** | `1845bf0aa19da7ace3c1d92fde50a9ecf009ce3139c252e357dfd4369885a474` | `b43c958c771bfa3f31f096ad47259670b15e8b5737dbfd6f5a789f269e3ed426` |
| **Deployment / UI Selection** | Selected by default Firebase rules deployment and copied by `FirestoreRulesNotice.tsx` (`FIRESTORE_RULES_TEXT`) | Excluded from deployment and UI rules helper (`Do NOT auto-deploy`) |
| **Matches Current Admin App Code?** | **NO** — rejects Admin-promoted `/orders`, rejects stock deductions, omits `/orderRequests` & `/settings/pricing`, misses second Admin UID & 2 Admin emails | **YES** — aligns with `src/lib/adminAllowlist.ts`, `src/lib/orderRequests.ts`, `src/lib/authoritativePricing.ts`, and `firebase-blueprint.json` |

---

## 3. Exact Security-Relevant Differences (File Paths & Line References)

1. **Anonymous Auth & Verification Gate:**
   - `firestore.rules:26-31`: Uses `isVerified()` (`sign_in_provider == 'google.com' || email_verified == true`).
   - `firestore.spark.rules:44-49`: Replaces with `isNonAnonymousUser()` explicitly rejecting `sign_in_provider == 'anonymous'`, and guards every privileged collection against anonymous tokens.
2. **Bootstrapped Admin UID & Email Allowlist Parity:**
   - `firestore.rules:33-44`: `isBootstrappedAdmin()` allows only **1** UID (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`) and **2** emails (`tashflow26@gmail.com`, `palmmetric1@gmail.com`).
   - `firestore.spark.rules:51-67`: `isVerifiedAdminToken()` adds the second Admin UID (`39H76y4E55g5yX2uY0lE5bQ3a393`, `line 53`) and two additional canonical emails (`palmmatric1@gmail.com`, `tashfilartwork@gmail.com`, `lines 62-63`), matching `src/lib/adminAllowlist.ts:1-11`.
   - *(Note on DB-backed admins in `/admins/{uid}`: both files expose `isAdmin()`, while collection `list` rules at `firestore.rules:228,248,265,285,342,360` and `firestore.spark.rules:407,416,427,436,445,456,490,498,512,528,537` intentionally restrict Admin `list` queries to bootstrapped token checks rather than dynamic `exists()` queries.)*
3. **Direct Customer `/orders` Creation vs Locked Request-to-Order Promotion:**
   - `firestore.rules:321-327`: **Allows customers to create `/orders/{orderId}` directly** (`allow create: if isVerified() && ... incoming().customerUid == request.auth.uid && incoming().status == 'Pending'`), completely bypassing Admin verification and authoritative catalog pricing.
   - `firestore.rules:107-121`: `isValidOrder` uses `hasOnly(['orderNumber', 'customerUid', 'customerName', 'customerContact', 'items', 'totalBill', 'status', 'notes', 'createdAt', 'updatedAt'])` and allows only `['Pending', 'Preparing', 'Ready', 'Completed']` (`line 117`). This **breaks** `approveAndPromoteOrderRequest()` (`src/lib/orderRequests.ts:748-775`), which writes `subtotal`, `discountTotal`, `taxTotal`, `currency`, `orderType`, `paymentMethod`, `paymentStatus`, `sourceApp`, `lang`, `idempotencyKey`, `pricingVersion`, `sourceRequestId`, `requestReference`, `approvedBy`, `approvedByEmail`, and `approvedAt`.
   - `firestore.spark.rules:312-342, 372, 507-518`: Closes direct customer `/orders` creation (`allow create: if isValidId(orderId) && isAdmin() && isValidPromotedOrderCreate(orderId, incoming())`), verifies cross-document `existsAfter`/`getAfter` links across `/orders/ord_<requestId>`, `/orderRequests/{requestId}` (`status == 'order_created'`), and `/orderNumbers/{orderNumber}`, and supports `'Cancelled'` on order updates.
4. **Stage 04L / 04N.2.4 Order Request, Audit Log & Order Number Collections:**
   - `firestore.rules`: **Absent** — contains zero rules for `/orderRequests`, `/orderRequests/{requestId}/auditLogs`, `/orderNumbers`, `/orderRequestAuditLogs`, or `/idempotencyKeys` (falling through to global deny at `lines 5-7`).
   - `firestore.spark.rules`:
     - `/orderRequests/{requestId}` (`lines 223-309, 451-460`): Enforces customer owner-scoped reads/creates (`status == 'pending_review'`, `requestReference` regex `^REQ-[a-zA-Z0-9_\-]+$`), Admin-only status transitions via `isAllowedRequestStatusTransition` (`reviewing` canonical output + legacy `under_review`/`in_review` readability), immutable customer/item payloads, mandatory non-empty `rejectionReason`, and `verifiedPricing.totalSar == totalBillSar` parity; deletes forbidden (`line 460`).
     - `/orderRequests/{requestId}/auditLogs/{logId}` (`lines 463-484`) & `/orderRequestAuditLogs/{auditId}` (`lines 496-504`): Append-only Admin audit trails (`allow update, delete: if false`).
     - `/orderNumbers/{orderNumber}` (`lines 344-355, 488-493`): Atomic unique `PM-XXXXXX` number claim registry (`allow update, delete: if false`).
     - `/idempotencyKeys/{keyId}` (`lines 521-523`): Explicitly closed (`allow read, write: if false`).
5. **Catalog Stock & Pricing Config Fields:**
   - `firestore.rules:55`: `isValidMenuItem` forbids `isAvailable`, `available`, `outOfStock`, `stockQuantity`, and `stockCount`, blocking Admin atomic stock deduction (`src/lib/orderRequests.ts:833-854`). `firestore.spark.rules:81, 92-93` permits and bounds them (`0..100000`).
   - `firestore.rules:249-258`: `/settings/{settingId}` allows writes only to `coffeeOptions`. `firestore.spark.rules:126-134, 419` adds `pricing` (`isValidPricingSettings`).
6. **Update `affectedKeys()` Whitelists on Non-Order Collections:**
   - `firestore.rules:240, 277, 297, 352`: Enforce `.diff(existing()).affectedKeys().hasOnly(...)` on `/categories`, `/menu`, `/billboards`, and `/admins`.
   - `firestore.spark.rules:409, 429, 438, 529`: Rely on full-document `hasOnly` + `createdAt == existing().createdAt` (preserving `.diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt'])` strictly on `/orders` `line 516`).

---

## 4. Test-to-Deployment Rules Consistency

**INCONSISTENT / SPLIT:** Deployment/UI references and test suites do **not** point to a single unified rules file:

| Target / Script | Rules File Read or Tested | Notes |
|---|---|---|
| Active deployment / UI `FirestoreRulesNotice` | **`firestore.rules`** (`via src/lib/firestoreRulesText.ts`) | Tested by `src/lib/productCustomizations.test.ts:215-241` for Stage 04B/04C; **never tests** Stage 04L/04N workflows |
| `scripts/stage04l.test.ts` (`#02, #17&18, #19, #20`) | **`firestore.spark.rules`** (`lines 380, 703, 734, 743`) | Static string/regex assertions against `firestore.spark.rules` only |
| `scripts/stage04m.test.ts` (`#08, #10`) | Both (`stage04m` `#08` reads both; `#10` reads `firestore.spark.rules`) | `#08` checks `firestore.rules` only for the substring `match /orders/{orderId}`; all Stage 04N.2.4 contract assertions check `firestore.spark.rules` (`line 380`) |
| `scripts/stage04n.test.ts` (43 tests) | **NEITHER** (`0` rules files read) | Uses `26` hardcoded/stub boolean checks instead of evaluating either rules file |
| Live Emulator rules tests | **NONE (`0` tests)** | No `@firebase/rules-unit-testing` test suite or `firebase.json` emulator target exists |

**Summary:** The hardened rules in `firestore.spark.rules` ARE verified statically (`stage04l` + `stage04m`) and modeled via in-memory transactions, **but** they are **not** the rules in `firestore.rules` / `FIRESTORE_RULES_TEXT`, and **zero** rules in either file have been evaluated dynamically against a Firestore Emulator runtime.

---

## 5. Identity A Recovery Result

- **Expected Identity A:** `palm-metric-stage04n24-admin.zip`, `64` files, `1,844,172` bytes, SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f`.
- **Search Result Across All Accessible Local Paths (`/app`, `/tmp`, `/workspace`, `/mnt`, `/root`):** **`UNRESOLVED — NOT RECOVERABLE LOCALLY`** (`0` matching archives or extracted trees).
- **Local Metadata Context:**
  - `.git` is absent (`no .git directory` at `/app/applet` or `/app`).
  - Historical project manifests (`STAGE_04N23_TEST_COUNT_RECONCILIATION.md:16, 62` and `STAGE_04N25_SHA256_RECONCILIATION_MANIFEST.json:31-38`) correlate Identity A's `36/36` test claim and `64`-file / `1.84 MB` size with an external upstream `54e5453` snapshot predating `stage04n.test.ts` (similar in size to `palm-metric-stage04m-runnable.zip` [`61` files, `1,834,970` bytes] and `palm-metric-stage04m1-runnable.zip` [`65` files, `1,839,171` bytes]).
- **Determination:** Identity A **cannot be independently recovered** from this container; **owner-supplied provenance** (either supplying the external `c00e9e4c...` archive or formally retiring the Identity A claim in favor of Identity B) is required. Identity B is **not** treated as equivalent to Identity A.

---

## 6. Identity B Provenance Status

- **Path:** `/app/applet/palm-metric-stage04n24-admin.zip`
- **File Count:** `112` files
- **Byte Size:** `1,927,570` bytes
- **SHA-256:** `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`
- **Status:** **PROVENANCE VERIFIED ON DISK (`112/112` byte-for-byte identical to `/app/applet` code, rules, blueprint, and test scripts)**.

---

## 7. Java & Emulator Readiness

| Check Item | Direct Observed Result | Status |
|---|---|---|
| `which java` / `java -version` | Binary absent (`NO_JAVA`) | **MISSING** |
| `JAVA_HOME` | `(unset)` | **UNSET** |
| `PATH` | `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` | Observed |
| Firebase CLI (`npx firebase --version`) | `15.36.0` installed locally | **PRESENT** |
| `firebase.json` / Emulator config | Absent from `/app/applet` (no emulator ports or rules path configured) | **MISSING** |
| Emulator Env Vars (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `GCLOUD_PROJECT`) | All `(unset)` (`.env.example` lists only `GEMINI_API_KEY` and `APP_URL`) | **UNSET** |
| Existing Test Commands (`package.json:12`) | `"test": "tsx --test scripts/*.test.ts"` (plus manual `src/lib/productCustomizations.test.ts`); all run in-memory/static with no Emulator dependency | **IN-MEMORY ONLY** |
| **Separate Java 17+ Environment Needed?** | **YES** — Live Firestore Emulator tests require an external/CI host with **OpenJDK 17+**, a `firebase.json` emulator rules config targeting the reconciled rules file, and a real `@firebase/rules-unit-testing` suite | **BLOCKED (`NO_JAVA`)** |

---

## 8. Exact Files Modified

- **Source / Configuration / Rules / Dependencies / Lockfiles / Archives Modified:** **`ZERO (0)`**
- Only this read-only audit report (`STAGE_04N28_ADMIN_RULES_AND_PROVENANCE_RECONCILIATION.md`) was created.

---

## 9. Final Verdict

### **`PASS WITH LIMITATIONS`**

All three reconciliation objectives (A: Rules Provenance, B: Archive Provenance, C: Emulator Readiness) completed cleanly with full, direct, read-only evidence and zero contradictions hidden. The verdict is constrained by four verified production-gating limitations:
1. Active `/app/applet/firestore.rules` (and `FIRESTORE_RULES_TEXT`) remains **legacy pre-Stage-04L**, diverging significantly from hardened `firestore.spark.rules`.
2. `firebase.json`, `.firebaserc`, and `.git` are absent from `/app/applet`.
3. **Identity A** (`c00e9e4c...`) remains **`UNRESOLVED`** locally and requires owner-supplied provenance.
4. Live Firestore Emulator evaluation is **`BLOCKED — NO_JAVA`**.

---

## 10. Recommended Next Safe Action

Before any deployment, Stage 04O work, or production cutover:
1. **Owner Sign-Off on Rules & Provenance:** Obtain owner confirmation to (a) promote hardened `/app/applet/firestore.spark.rules` into canonical `/app/applet/firestore.rules` + `/app/applet/src/lib/firestoreRulesText.ts` (and preserve `.diff().affectedKeys()` guards where appropriate), and (b) either supply external Identity A (`c00e9e4c...`) or formally retire it in favor of Identity B (`be072ce3...`).
2. **Emulator Verification on a Java 17+ Host:** In a separate OpenJDK 17+ environment with a dedicated `firebase.json` (`emulators.firestore.rules`), execute `@firebase/rules-unit-testing` tests against the unified `firestore.rules` (replacing the `26` stubbed checks in `scripts/stage04n.test.ts`) before deploying rules to `palm-metric-app`.
