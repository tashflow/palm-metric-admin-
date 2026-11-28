# STAGE 04N.2.3 — ADMIN ARCHIVE VERIFICATION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Archive Audited:** `palm-metric-stage04n22-admin.zip`  
**Extraction Directory:** `/tmp/stage04n23_verify/admin`  
**Workspace Compared:** `/app/applet`  
**Audit Date:** 2026-11-26  
**Verdict:** **`PASS WITH LIMITATIONS`** (Archive integrity & internal Admin implementation verified; blocked on Live Emulator `NO_JAVA`, cross-app Customer archive mismatch, and legacy `firestore.rules` drift)

---

## 1. Archive Metadata & Workspace Parity

| Metric | Value |
|---|---|
| **Archive File** | `/app/applet/palm-metric-stage04n22-admin.zip` |
| **Exact Byte Size** | `1,893,684` bytes |
| **Exact File Count** | `98` files |
| **Archive SHA-256** | `032688b3a8ee577a76bcc64ea20c0a94a79dd2251ec1196db112599aa941a9e4` |
| **Extracted vs ZIP Parity** | `98 / 98` files match (`exact match: True`) |
| **Archive vs `/app/applet` Diff** | **`0` modified files** (`Modified between 04N22 Admin zip and Workspace: []`). `/app/applet` contains `8` additional `STAGE_04N22_*.md/.json` report files written after packaging (`+` `package-lock.json` excluded from zip). |

---

## 2. Admin Contract & Implementation Inspection (Verified in Both Archive & Workspace)

1. **Firebase Project & DB Alignment:**
   - `firebase-applet-config.json` and `src/lib/firebase.ts` point to `palm-metric-app` / `(default)`.
2. **Order Status Canonicalization (`'under_review'`):**
   - `src/lib/orderRequests.ts:114-117` normalizes `'under_review' | 'reviewing' -> 'under_review'`.
   - `src/lib/orderRequests.ts:461,473` writes `status: 'under_review'`.
   - `firestore.spark.rules:253-259` transitions `pending_review -> under_review` while permitting legacy `'reviewing'` as `prev.status`.
3. **Order Identifiers (`sourceRequestId`) & Order Number Claims (`/orderNumbers`):**
   - `src/lib/orderRequests.ts:768,913` writes `sourceRequestId: req.id` on `/orders/ord_<requestId>`.
   - `src/lib/orderRequests.ts:691-716,858-866` reserves collision-checked `PM-XXXXXX` via `/orderNumbers/{orderNumber}`.
   - `firestore.spark.rules:312-355` validates deterministic `ord_<sourceRequestId>`, `/orderRequests` linkage, and `/orderNumbers` claim existence in the same transaction.
4. **Atomic Inventory Deduction (`computeStockDeductionPlans`):**
   - `src/lib/authoritativePricing.ts:689-717` aggregates quantities per SKU across split lines.
   - `src/lib/orderRequests.ts:828-855` atomically decrements `stockQuantity` / `stockCount` via `tx.updateMenuDoc` inside `runTransaction` and flips `inStock: false` (plus `outOfStock: true`, `isAvailable: false`, `available: false` when present) on reaching `0`.
   - Rejected requests do not modify menu stock.
5. **Admin Allowlist & Email Verification Fail-Closed Hardening:**
   - `src/lib/adminAllowlist.ts`, `src/lib/firebase.ts`, and `firestore.spark.rules:53-65` align on **4 emails** (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`) and **2 UIDs** (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`).
   - `src/contexts/AuthContext.tsx:141-154` denies unverified email matches (`denialReason: 'unverified'`).
   - **Legacy Note:** Legacy `firestore.rules` (not `firestore.spark.rules`) remains unmodified at 1 UID (`jPgFPc8...`) and 2 emails (`tashflow26`, `palmmetric1`) without `/orderRequests` rules; per Stage 04N.2.3 rules, neither rules file was altered.

---

## 3. Read-Only Build & Test Verification (Executed in Identical `/app/applet` Workspace)

| Check | Command | Outcome | Notes |
|---|---|---|---|
| **TypeScript (`tsc --noEmit`)** | `npx tsc --noEmit` | **PASS (`EXIT 0`)** | `0` errors across all Admin sources & tests |
| **Vite Production Build** | `npx vite build --outDir /tmp/stage04n23_verify/admin_dist --emptyOutDir` | **PASS (`EXIT 0`, 1.16s)** | Output directed to `/tmp` to preserve workspace immutability (`1,475.55 kB` JS bundle) |
| **Admin `npm test`** | `npm test` (`tsx --test scripts/*.test.ts`) | **71 / 71 PASS (`EXIT 0`)** | `stage04l.test.ts` (`19`) + `stage04m.test.ts` (`9`) + `stage04n.test.ts` (`43`); includes `24` static/stub checks in `stage04n.test.ts`; **0** live Emulator tests |
| **Customizations Test Suite** | `npx tsx --test src/lib/productCustomizations.test.ts` | **10 / 10 PASS (`EXIT 0`)** | Not part of `npm test` glob; all `10` pass |
| **Standalone Extracted Run** | `/tmp/stage04n23_verify/admin` | **Requires `npm install`** | Archive excludes `node_modules`; `0` source/config/test file diffs vs `/app/applet` |
| **Live Firebase Emulator** | `java -version` / `firebase-tools 15.36.0` | **BLOCKED (`NO_JAVA`)** | Java missing from container |

> **Honesty Note:** Although `palm-metric-stage04n22-admin.zip` accurately packages the Stage 04N.2.2 Admin source code, the prior `STAGE_04N22_TEST_INVENTORY_REPORT.md` misrepresented the `71`-test split, omitted the `10` `productCustomizations.test.ts` tests, and `STAGE_04N22_ADMIN_CONTRACT_REPORT.md` assumed cross-app convergence with a Customer archive that actually lacked Stage 04N.2.2 updates.
