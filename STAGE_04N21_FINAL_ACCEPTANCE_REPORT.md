# STAGE 04N.2.1 — Final Release Baseline Acceptance Report

**Date:** 2026-11-25  
**Target Environment:** Firebase Project `palm-metric-app` | Firestore Database `(default)` | Currency `SAR` | Fulfillment `pickup` only  
**Verification Mode:** Local release-integrity & artifact reconciliation ONLY (No deployments, no production Firestore writes, no production rules changes, no GitHub pushes)

---

## 1. Final Acceptance Decision

### **VERDICT: `PASS WITH LIMITATIONS`**

**Rationale:**
- **PASS:** Both authoritative Stage 04N.2.1 ZIP archives are cleanly separated, cryptographically locked in `STAGE_04N21_SHA256_MANIFEST.json`, verified `100%` byte-for-byte upon extraction (`108/108` Customer files, `87/87` Admin files), and pass all TypeScript (`tsc --noEmit`), Vite production builds, static audit checks, and **148/148** automated regression tests (`69` Customer + `79` Admin) from extracted copies.
- **LIMITATION 1 (Environment):** Live Firebase Emulator execution (`auth` + `firestore` + `firestore.spark.rules`) is **`BLOCKED` (`NO_JAVA`)** because `java` is missing from this container (`sh: 1: java: not found`), and neither repository includes `@firebase/rules-unit-testing`. All 148 passing tests are in-memory mock/unit or static rules checks, not live Firestore rules executions.
- **LIMITATION 2 (Cross-App Runtime Contract Drifts Documented for Next Remediation Stage):** Per Stage 04N.2.1 verification-only rules, source logic was not altered; four cross-app contract differences (`'under_review'` vs `'reviewing'`, Admin `orderRequests.ts` missing `/menu` stock decrement writes despite validation, `requestId` vs `sourceRequestId`, and allowlist parity across 6 files) remain documented for targeted reconciliation prior to production Spark rules deployment.

---

## 2. Locked Authoritative Stage 04N.2.1 Release Archives

| Application | Archive File | Provenance | File Count | Size (Bytes) | Authoritative SHA-256 |
|---|---|---|---:|---:|---|
| **Palm Metric Customer App** | `/palm-metric-stage04n21-customer.zip` | `https://github.com/tashflow/Palm-Metric` (`main` @ `9f265abfcd54585613470f71072ee91855147ffa`, `108` tracked non-zip files) | **108** | **28,096,952** | `e384f5db1b19829b6f2d19e8be3426d32b14cd95b556c98eb10edb0575313665` |
| **Palm Metric Admin App** | `/palm-metric-stage04n21-admin.zip` | `/app/applet` (based on `https://github.com/tashflow/palm-metric-admin-` @ `54e545382681a4e114257e3d035e22b94708f8fa` + Stage 04M.2/04N updates) | **87** | **1,870,040** | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` |

*(All earlier checkpoint archives on disk — `04l`, `04m`, `04m1`, `04m2`, `04n`, `04n1`, `04n2` — remain intact.)*

---

## 3. Summary of Resolved Stage 04N.2 Conflicts

1. **Archive Conflict Resolution:**
   - Cited hashes `a70474bd...` (`134` files, `28,131,159` bytes) and `69e7af5e...` (`64` files, `1,843,328` bytes) are **not present on disk** (`64` files corresponds to pure upstream Admin `54e5453` minus `.github/workflows/deploy.yml`).
   - On disk, `palm-metric-stage04n2-customer.zip` (`109` files, `28,141,602` bytes, `1ed5781e...`) included 1 untracked `package-lock.json` from `npm install`. Stage 04N.2.1 locks `palm-metric-stage04n21-customer.zip` strictly to `git ls-files` (`108` files, `28,096,952` bytes, `e384f5db...`).
   - `palm-metric-stage04n21-admin.zip` (`87` files, `1,870,040` bytes, `e449dfcf...`) is bit-for-bit identical to `palm-metric-stage04n2-admin.zip`.
2. **Test Count Conflict Resolution (`118 = 82 + 36` vs `148 = 69 + 79`):**
   - Customer runs **69** active Spark tests (`12 + 17 + 20 + 12 + 8`) plus `scripts/audit-rules.mjs` (and contains **20** unexecuted legacy Blaze tests in `functions/src/__tests__/orderEngine.test.ts`). The earlier `82` figure double-counted `stage04d.test.ts` (`12`) + `audit-rules.mjs` (`1`).
   - Admin ran **36** tests at upstream commit `54e5453` (`18 + 8 + 10`) and runs **79** tests after adding `scripts/stage04n.test.ts` (`43` tests).

---

## 4. Extracted Verification Summary

| Target | Lint (`tsc --noEmit`) | Build (`vite build`) | Automated Tests | Audit Script | Live Emulator |
|---|---|---|---|---|---|
| **Extracted Customer (`108` files)** | Exit `0` | Exit `0` | **69 / 69 Passed** (`0` failed) | Exit `0` (`audit-rules.mjs`) | **BLOCKED (`NO_JAVA`)** |
| **Extracted Admin (`87` files)** | Exit `0` | Exit `0` | **79 / 79 Passed** (`0` failed) | N/A | **BLOCKED (`NO_JAVA`)** |

---

## 5. Safety Compliance Confirmation

- Firebase Hosting deployment executed: **No**
- Production Firestore rules modified or deployed: **No**
- Production Firestore database read/written by tests: **No**
- Cloud Functions created or deployed: **No**
- GitHub commits or pushes executed: **No**
- New application features or UI redesigns added: **No**

---

## 6. Deliverables Created (Stage 04N.2.1)

- `/STAGE_04N21_SOURCE_PROVENANCE_REPORT.md`
- `/STAGE_04N21_ARCHIVE_RECONCILIATION_REPORT.md`
- `/STAGE_04N21_SHA256_MANIFEST.json`
- `/STAGE_04N21_TEST_INVENTORY_REPORT.md`
- `/STAGE_04N21_EMULATOR_STATUS_REPORT.md`
- `/STAGE_04N21_CROSS_APP_CONTRACT_REPORT.md`
- `/STAGE_04N21_FINAL_ACCEPTANCE_REPORT.md`
- `/palm-metric-stage04n21-customer.zip`
- `/palm-metric-stage04n21-admin.zip`
