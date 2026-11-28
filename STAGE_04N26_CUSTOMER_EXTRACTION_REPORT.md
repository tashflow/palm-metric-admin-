# STAGE 04N.2.6 — Customer Archive Extraction Report

**Audit Stage:** Stage 04N.2.6 (Strictly Read-Only)  
**Extraction Root:** `/tmp/stage04n26_extract/<tag>`

---

## 1. Per-Archive Extraction & Verification Table

| Archive | Extracted Path | Zip Files | Extracted Files | Hash Mismatches | Customer Source? | `node_modules` / `package-lock.json` / `bun.lock` | `audit-rules.mjs` | `tsc` / `vite` / `tsx` (Customer-only) |
|---|---|---:|---:|---:|:---:|---|---|---|
| Identity A (`f98e5646...`) | *Not extracted* | `143` *(expected)* | `0` | N/A | N/A | N/A | N/A | **`UNRESOLVED — SOURCE ARCHIVE NOT AVAILABLE`** |
| `palm-metric-stage04n24-customer.zip` | `/tmp/stage04n26_extract/stage04n24-customer` | `108` | `108` | `0` | **Yes** | `false` / `false` / `true` | **PASS (`EXIT 0`)** | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `firebase`, `react`)** |
| `palm-metric-stage04n22-customer.zip` | `/tmp/stage04n26_extract/stage04n22-customer` | `107` | `107` | `0` | **Yes** *(stale 04N.2.1)* | `false` / `false` / `true` | **PASS (`EXIT 0`)** | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |
| `palm-metric-stage04n21-customer.zip` | `/tmp/stage04n26_extract/stage04n21-customer` | `108` | `108` | `0` | **Yes** *(04N.2.1)* | `false` / `false` / `true` | **PASS (`EXIT 0`)** | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |
| `palm-metric-stage04n2-customer.zip` | `/tmp/stage04n26_extract/stage04n2-customer` | `109` | `109` | `0` | **Yes** *(04N.2)* | `false` / `true` / `true` | **PASS (`EXIT 0`)** | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |
| `palm-metric-stage04n1-customer.zip` | `/tmp/stage04n26_extract/stage04n1-customer` | `87` | `87` | `0` | **No** *(Admin tree)* | `false` / `true` / `true` | Skipped (no `audit-rules.mjs`) | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |
| `palm-metric-stage04n-customer.zip` | `/tmp/stage04n26_extract/stage04n-customer` | `81` | `81` | `0` | **No** *(Admin dup)* | `false` / `true` / `true` | Skipped (no `audit-rules.mjs`) | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |
| `palm-metric-stage04m2-customer.zip` | `/tmp/stage04n26_extract/stage04m2-customer` | `73` | `73` | `0` | **No** *(Admin dup)* | `false` / `true` / `true` | Skipped (no `audit-rules.mjs`) | **FAILED (`EXIT 1`: missing `tsc`, `vite`, `node_modules`)** |

---

## 2. Diff Summary: `04n24-customer` (108 files) vs `04n22-customer` (107 files)

Direct extracted SHA-256 comparison confirmed `palm-metric-stage04n24-customer.zip` differs from superseded `palm-metric-stage04n22-customer.zip` in `1` added file (`functions/package-lock.json`) and `14` updated convergence files (`firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.spark.rules`, `scripts/stage04k.test.ts`, `scripts/stage04l.test.ts`, `scripts/stage04l1.test.ts`, `scripts/stage04m.test.ts`, `src/components/AdminOrderRequestsPage.tsx`, `src/components/OrderTrackerPage.tsx`, `src/lib/adminAuth.ts`, `src/lib/adminOrderRequests.ts`, `src/lib/authoritativePricing.ts`, `src/lib/firestoreSync.ts`, `src/types.ts`).
