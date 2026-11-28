# STAGE 04N.2.5 — Admin Artifact Reconciliation Report

**Audit Stage:** Stage 04N.2.5 (Strictly Read-Only Independent Reconciliation)  
**Target:** Palm Metric Admin App (`Verda Admin — Specialty Coffee & Food Management`)  
**Live Workspace Path:** `/app/applet` (Confirmed to be the Admin App repository workspace)

---

## 1. Conflicting Admin Archive Identities Under Investigation

| Identity | Reported / On-Disk Location | File Count | Byte Size | SHA-256 Checksum | Reported Test Claim | Stage 04N.2.5 Classification |
|---|---|---:|---:|---|---|---|
| **Identity A** | External session report (absent on disk) | `64` | `1,844,172` | `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f` | `36/36` | **`UNRESOLVED`** *(not present anywhere on disk; matches legacy upstream `54e5453` size/count range)* |
| **Identity B** | `/app/applet/palm-metric-stage04n24-admin.zip` | `112` | `1,927,570` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | `82/82` | **`AUTHORITATIVE PRESENT CANDIDATE`** *(100% byte-for-byte match to `/app/applet` source/reports/rules)* |

---

## 2. Direct Verification of `palm-metric-stage04n24-admin.zip` (Identity B)

- **Exact Path:** `/app/applet/palm-metric-stage04n24-admin.zip`
- **ZIP File Count:** `112` files
- **ZIP Byte Size:** `1,927,570` bytes
- **SHA-256 Checksum:** `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`
- **Archive Timestamp (UTC):** `2026-11-27T14:31:04.950142+00:00`
- **Extraction Directory (`/tmp/stage04n25_audit/admin`):** `112 / 112` files extracted cleanly with **`0` SHA-256 mismatches**.
- **Byte-for-Byte Comparison Against `/app/applet` (excluding `node_modules`, `dist`, `.git`, `.aistudio`, `*.zip`, `package-lock.json`):**
  - `only_in_admin_zip`: **`[]` (0)**
  - `content_diffs`: **`[]` (0)**
  - `only_in_applet`: Strictly the **8 `STAGE_04N24_*` reports** generated after `palm-metric-stage04n24-admin.zip` was packaged (`STAGE_04N24_ADMIN_COMPATIBILITY_REPORT.md`, `STAGE_04N24_CROSS_APP_INTEGRATION_REPORT.md`, `STAGE_04N24_CUSTOMER_RESTORATION_REPORT.md`, `STAGE_04N24_EMULATOR_STATUS_REPORT.md`, `STAGE_04N24_FINAL_ACCEPTANCE_REPORT.md`, `STAGE_04N24_FIREBASE_CONFIGURATION_REPORT.md`, `STAGE_04N24_REGRESSION_REPORT.md`, `STAGE_04N24_SHA256_MANIFEST.json`).

---

## 3. Build & Test Verification Results

| Check | Scope | Result | Notes |
|---|---|---|---|
| `npm run lint` (`tsc --noEmit`) | `/app/applet` | **PASS (`0` errors)** | Verified directly in `/app/applet` |
| `npm run build` (`vite build`) | `/app/applet` | **PASS (`1.29s`)** | Production Vite bundle (`dist/index.html` + assets) |
| `npm test` (`tsx --test scripts/*.test.ts`) | `/app/applet` | **72 / 72 PASS** | `stage04l.test.ts` (19) + `stage04m.test.ts` (10) + `stage04n.test.ts` (43) |
| `npx tsx --test src/lib/productCustomizations.test.ts` | `/app/applet` | **10 / 10 PASS** | Omitted from `npm test` glob `scripts/*.test.ts`; executed explicitly |
| Extracted archive check (`/tmp/stage04n25_audit/admin`) | 112 extracted files | **PASS (`tsc --noEmit` EXIT 0, `82 / 82` PASS)** | Executed against shared `/app/applet/node_modules` (ZIP itself excludes `node_modules` and `package-lock.json`, bundling `bun.lock`) |
| Live Firebase Emulator | `firestore`, `auth` | **`BLOCKED — NO_JAVA`** | `java: not found`; `firebase-tools@15.36.0` present |

---

## 4. Identity A (`c00e9e4c...`) Provenance Investigation

- Full workspace search returned **`0` matches** for SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f`, byte size `1,844,172`, or a `64`-file Admin archive.
- For comparison, historical `palm-metric-stage04m-runnable.zip` has `61` files (`1,834,970` bytes) and `palm-metric-stage04m1-runnable.zip` has `65` files (`1,839,171` bytes); Identity A (`64` files, `1,844,172` bytes) originates from an external packaging snapshot not stored in `/app/applet` and is therefore marked **`UNRESOLVED`**.
- **Test Count Root Cause Explained:** The `36/36` test count matches the documented upstream Admin `54e5453` baseline recorded in `STAGE_04N23_TEST_COUNT_RECONCILIATION.md` (`stage04l.test.ts` `18` + `stage04m.test.ts` `8` + `src/lib/productCustomizations.test.ts` `10` = `36`), predating `scripts/stage04n.test.ts` (`+43`) and Stage 04N.2.2/04N.2.4 additions (`+3`, totaling `82`).
