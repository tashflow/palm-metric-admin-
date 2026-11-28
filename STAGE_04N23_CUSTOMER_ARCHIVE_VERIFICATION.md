# STAGE 04N.2.3 — CUSTOMER ARCHIVE VERIFICATION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Archive Audited:** `palm-metric-stage04n22-customer.zip`  
**Extraction Directory:** `/tmp/stage04n23_verify/customer`  
**Audit Date:** 2026-11-26  
**Verdict:** **`FAIL` — Critical Provenance & Contract Convergence Failure**

---

## 1. Archive Metadata & Integrity Check

| Metric | Value |
|---|---|
| **Archive File** | `/app/applet/palm-metric-stage04n22-customer.zip` |
| **Exact Byte Size** | `28,065,764` bytes |
| **Exact File Count** | `107` files |
| **Archive SHA-256** | `14254ac4e37e95f8fe12c33c846c1c059181259c191f53ddc5bd750fd1ca1e61` |
| **Extracted vs ZIP Parity** | `107 / 107` files match (`exact match: True`) |
| **Matches `STAGE_04N22_SHA256_MANIFEST.json`** | Metadata matches; **claimed code content does NOT** |

---

## 2. Critical Forensic Discovery: Un-Converged Stage 04N.2.1 Contents

Comparing every single file in `palm-metric-stage04n22-customer.zip` (`107` files) against Stage 04N.2.1 baseline `palm-metric-stage04n21-customer.zip` (`108` files, SHA-256 `e384f5db1b19829b6f2d19e8be3426d32b14cd95b556c98eb10edb0575313665`) yields:

- **Modified files between Stage 04N.2.1 and Stage 04N.2.2 Customer archives:** **`0`** (`[]`)
- **Files only in Stage 04N.2.1 Customer archive:** `functions/package-lock.json` (`1` file omitted)
- **Files only in Stage 04N.2.2 Customer archive:** **`0`** (`[]`)

**Root Cause:** The temporary Customer repository (`/tmp/stage04n2_customer_repo`) used in an earlier session was wiped when `/tmp` reset, and `palm-metric-stage04n22-customer.zip` was subsequently packaged from Stage 04N.2.1 Customer source (`palm-metric-stage04n21-customer.zip`) without the Stage 04N.2.2 Customer convergence edits.

---

## 3. Discrepancies Found Inside Extracted Customer Archive

1. **Order Review Status Still `'reviewing'` (Contract Discrepancy A):**
   - `src/types.ts:153` defines `'reviewing'` (not `'under_review'`).
   - `src/lib/firestoreSync.ts:950` `normalizeOrderRequestStatus` maps `'reviewing' | 'in_review' -> 'reviewing'` and falls back to `'pending_review'` for `'under_review'`.
   - `src/lib/adminOrderRequests.ts:320,336,350,358` writes `status: 'reviewing'`.
   - `firestore.spark.rules:380` restricts `data.status` to `['pending_review', 'reviewing', 'verified', 'order_created', 'approved', 'rejected', 'cancelled']` — **rejecting `'under_review'`** written by Admin App.
2. **Missing `requestReference` on Order Request Create:**
   - `src/lib/firestoreSync.ts:905-918` (`buildCustomerOrderRequestPayload`) does **not** emit `requestReference` (`REQ-...`), whereas Admin `firestore.spark.rules:224,232` requires `requestReference` (`^REQ-[a-zA-Z0-9_\-]+$`) on every `/orderRequests/{requestId}` create.
3. **`verifiedPricing` Shape Mismatch:**
   - `src/lib/authoritativePricing.ts:785,894` emits `totalBillSar` without `totalSar`, whereas Admin `firestore.spark.rules:280,303` requires `data.verifiedPricing.totalSar`.
4. **Admin Allowlist Drift (Contract Discrepancy D):**
   - `src/lib/adminAuth.ts:9`, `firestore.spark.rules:48`, and `firestore.rules:42` only list 1 UID (`'39H76y4E55g5yX2uY0lE5bQ3a393'`) and **omit** Admin UID `'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'` (present in Admin `adminAllowlist.ts` and Admin `firestore.spark.rules`).
5. **Audit Log Path Drift:**
   - `src/lib/adminOrderRequests.ts:179,1055` and `firestore.spark.rules:740` use root `/orderRequestAuditLogs/{auditId}`, with **no** rule for `/orderRequests/{requestId}/auditLogs/{logId}` used by Admin `src/lib/orderRequests.ts`.
6. **Stale `firebase-applet-config.json`:**
   - `firebase-applet-config.json` still references `"projectId": "universal-nomad-kwpgt"` and `"firestoreDatabaseId": "ai-studio-d605dbc1-6b60-4f95-aa23-547f79d7d4d8"`, contradicting `src/lib/firebase.ts` (`palm-metric-app`) and Admin `firebase-applet-config.json` (`palm-metric-app`, `(default)`).

---

## 4. Extracted Build & Test Execution Verification (Read-Only)

- **Dependencies (`node_modules`):** Absent in `/tmp/stage04n23_verify/customer` (archive contains no `node_modules` and no root `package-lock.json`; requires `@vis.gl/react-google-maps` and `adm-zip` beyond Admin `node_modules`). Per Stage 04N.2.3 strict read-only rule (*do not install dependencies unless explicitly necessary and approved*), `npm install` was **not** executed.
- **`node scripts/audit-rules.mjs` (in `/tmp/stage04n23_verify/customer`):** **PASS (`EXIT 0`)** — static audit of legacy `firestore.rules` + `firebase-blueprint.json` only.
- **TypeScript (`tsc --noEmit`):** **NOT EXECUTED** from extracted Customer archive without dependencies.
- **Production Build (`vite build`):** **NOT EXECUTED** from extracted Customer archive without dependencies.
- **Customer TypeScript Suites (`69` tests across `stage04d`, `04k`, `04l`, `04l1`, `04m`):** **NOT EXECUTED** in Stage 04N.2.3 (`ERR_MODULE_NOT_FOUND` for `firebase`/`react` without `npm install`).
- **Live Firebase Emulator:** **BLOCKED (`NO_JAVA`)**.

> **Honesty Note:** Claims in `STAGE_04N22_CUSTOMER_CONTRACT_REPORT.md` and `STAGE_04N22_FINAL_ACCEPTANCE_REPORT.md` that the Stage 04N.2.2 Customer archive incorporated the `'under_review'` convergence and compiled cleanly in Stage 04N.2.2 are **refuted** by the cryptographic byte-for-byte identity between `palm-metric-stage04n22-customer.zip` and `palm-metric-stage04n21-customer.zip`.
