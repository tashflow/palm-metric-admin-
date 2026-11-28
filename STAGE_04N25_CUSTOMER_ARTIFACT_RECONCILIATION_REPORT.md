# STAGE 04N.2.5 — Customer Artifact Reconciliation Report

**Audit Stage:** Stage 04N.2.5 (Strictly Read-Only Independent Reconciliation)  
**Target:** Palm Metric Customer App  
**Container Workspace Context:** `/app/applet` in this container is the **Admin App** (`Verda Admin — Specialty Coffee & Food Management`), NOT the live Customer App workspace (`tashflow/Palm-Metric`). The separate Customer App repository is not mounted directly in this container; Customer verification rests on the `.zip` archives stored inside `/app/applet`.

---

## 1. Conflicting Customer Archive Identities Under Investigation

| Identity | Reported / On-Disk Location | File Count | Byte Size | SHA-256 Checksum | Reported Test Claim | Stage 04N.2.5 Classification |
|---|---|---:|---:|---|---|---|
| **Identity A** | External session report (absent on disk) | `143` | `28,158,125` | `f98e56463fb29a00a78eb1b58dcc915dfa7394da65878fc93e6fc56b310dec88` | `90/90` | **`UNRESOLVED`** *(not present anywhere in `/app/applet`, `/tmp`, `/app`, or `/workspace`)* |
| **Identity B** | `/app/applet/palm-metric-stage04n24-customer.zip` | `108` | `28,099,225` | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` | `70/70` | **`AUTHORITATIVE PRESENT CANDIDATE`** *(physically verified, extracted `108/108`)* |

---

## 2. Direct Verification of `palm-metric-stage04n24-customer.zip` (Identity B)

- **Exact Path:** `/app/applet/palm-metric-stage04n24-customer.zip`
- **ZIP File Count:** `108` files (`0` directory entries counted as files)
- **ZIP Byte Size:** `28,099,225` bytes
- **SHA-256 Checksum:** `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`
- **Archive Timestamp (UTC):** `2026-11-27T14:31:09.203830+00:00`
- **Extraction Directory (`/tmp/stage04n25_audit/customer`):** `108 / 108` files extracted with **`0` SHA-256 mismatches** against ZIP entry digests.
- **Directory & Revision Contents Confirmed:**
  - Genuine Customer App tree (`src/components/CheckoutPage.tsx`, `src/components/OrderTrackerPage.tsx`, `src/components/MenuPage.tsx`, `src/components/AdminOrderRequestsPage.tsx`, `src/components/GoogleMapsLocation.tsx`, `src/lib/firestoreSync.ts`, `src/lib/adminOrderRequests.ts`, `src/lib/adminAuth.ts`, `src/lib/authoritativePricing.ts`, `public/`, `functions/`, `scripts/`).
  - Contains Stage 04N.2.4 converged source and configuration (`firebase-applet-config.json` -> `palm-metric-app` / `(default)`, canonical `'reviewing'` with `'under_review'`/`'in_review'` normalization, `requestReference`, `sourceRequestId`, `verifiedPricing.totalSar` == `totalBillSar`, nested `/orderRequests/{requestId}/auditLogs/{logId}`, and dual Admin UIDs / 4 Admin emails).
  - Note on older mislabeled archives: `palm-metric-stage04m2-customer.zip` (`3a3801a5...`) and `palm-metric-stage04n-customer.zip` (`7cc31781...`) in `/app/applet` are byte-for-byte duplicates of Admin archives (`73` and `81` files), and `palm-metric-stage04n22-customer.zip` (`14254ac4...`) was stale Stage 04N.2.1 Customer code. All earlier packages are **superseded**.

---

## 3. Standalone Extraction Integrity & Execution Reality

| Check | Outcome in Stage 04N.2.5 | Details |
|---|---|---|
| Standalone extraction (`108/108`) | **PASS** | All `108` files extracted cleanly; byte-for-byte intact. |
| `node scripts/audit-rules.mjs` (bare extract, no `node_modules`) | **PASS (`EXIT 0`)** | Pure Node script executes without dependencies (`PASS: Static security & schema audit passed for firestore.rules and firebase-blueprint.json.`). |
| `scripts/stage04d.test.ts` (12), `stage04k.test.ts` (17), `stage04l.test.ts` (20), `stage04l1.test.ts` (12), `stage04m.test.ts` (9) | **70 / 70 PASS** *(via temporary symlink to `/app/applet/node_modules`)* | Cannot execute bare without `node_modules` (`palm-metric-stage04n24-customer.zip` omits `node_modules` and `package-lock.json`, bundling `bun.lock` instead). All `70` tests passed when resolved against shared `/app/applet/node_modules`. |
| Standalone `npm install --legacy-peer-deps` + `tsc --noEmit` + `vite build` | **NOT REPRODUCED in this container** | Isolated `npm install` in `/tmp/stage04n25_audit/customer` stalled without completing; checking `tsc --noEmit` against Admin's shared `node_modules` failed on `src/components/GoogleMapsLocation.tsx` (`error TS2307: Cannot find module '@vis.gl/react-google-maps'`), confirming `@vis.gl/react-google-maps` is Customer-specific and absent from Admin's dependencies. |
| Live Firebase Emulator rules & transactions | **`BLOCKED — NO_JAVA`** | `java: not found`; `firebase-tools@15.36.0` present. |

---

## 4. Identity A (`f98e5646...`) Provenance Investigation

- Workspace search across `/app/applet` (all files, manifests, and reports) and `/tmp` returned **`0` matches** for SHA-256 `f98e56463fb29a00a78eb1b58dcc915dfa7394da65878fc93e6fc56b310dec88`, byte size `28,158,125`, and file count `143`.
- Because the external Customer App workspace (`tashflow/Palm-Metric`) is separate from this Admin container, Identity A could not be located, extracted, or inspected here and remains **`UNRESOLVED`**.
- **Test Count Root Cause Explained:** The `90/90` figure associated with Identity A equals the **`70`** active Spark tests (`12 + 17 + 20 + 12 + 9`) **plus** the **`20`** inactive legacy Blaze Cloud Functions tests in `functions/src/__tests__/orderEngine.test.ts` (`70 + 20 = 90`).
