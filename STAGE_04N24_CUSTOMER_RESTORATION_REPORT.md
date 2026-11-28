# STAGE 04N.2.4 — Customer Archive Restoration Report

## 1. Purpose & Baseline Provenance
Stage 04N.2.3 identified that the earlier Stage 04N.2.2 release-freeze verification failed because the previous Customer archive contained stale Stage 04N.2.1 code rather than converged Stage 04N.2.2/04N.2.4 cross-app contracts.

For Stage 04N.2.4, **Phase 1 — Customer App Restoration** was executed first in an isolated temporary workspace (`/tmp/stage04n24_customer`) seeded from the verified Stage 04N.2.1 baseline (`palm-metric-stage04n21-customer.zip`, 108 files), completely separated from the Admin workspace (`/app/applet`).

## 2. Restored Customer Capabilities & File Changes
All required convergence contracts were restored directly into Customer App source, Spark rules, configuration, and verification tests:

1. **Firebase Project Identity (`firebase-applet-config.json`)**
   - Replaced stale AI Studio remix metadata (`universal-nomad-kwpgt` / `ai-studio-d605dbc1-6b60-4f95-aa23-547f79d7d4d8`) with canonical `palm-metric-app` / `(default)` matching `src/lib/firebase.ts`, `public/firebase-messaging-sw.js`, and Admin App.
2. **Admin UID & Email Allowlist Parity (`src/lib/adminAuth.ts`, `firestore.spark.rules`)**
   - Restored `'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'` alongside `'39H76y4E55g5yX2uY0lE5bQ3a393'` in `ADMIN_UIDS` and `firestore.spark.rules` (`ADMIN_EMAILS`: `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`).
   - Preserved frozen legacy `firestore.rules` untouched per policy.
3. **Canonical Status & Legacy Normalization (`src/lib/firestoreSync.ts`)**
   - `normalizeOrderRequestStatus` maps `'reviewing'`, `'in_review'`, and legacy `'under_review'` cleanly to canonical **`'reviewing'`**.
4. **Canonical `requestReference` & `sourceRequestId` Provenance (`src/types.ts`, `src/lib/firestoreSync.ts`, `src/lib/adminOrderRequests.ts`)**
   - `buildCustomerOrderRequestPayload` emits `requestReference` (`REQ-...` formatted via `formatOrderRequestNumber(cleanRequestId)`).
   - `mapOrderRequestSnapshot`, `preserveExistingRequestCore`, promoted `/orders` writes, and `mapOrderSnapshot` emit and preserve `requestReference` and `sourceRequestId`.
5. **Dual Pricing Field Convergence (`src/types.ts`, `src/lib/authoritativePricing.ts`, `src/lib/firestoreSync.ts`, `src/components/OrderTrackerPage.tsx`)**
   - `VerifiedPricingBreakdown` includes `totalSar: number` alongside `totalBillSar: number`, both populated from exact integer halala arithmetic.
   - `mapOrderRequestSnapshot` resolves `verifiedTotalSar` from `data.verifiedTotalSar ?? totalSar ?? totalBillSar` and populates both `totalSar` and `totalBillSar` on `verifiedPricing`.
   - `OrderTrackerPage.tsx` reads `verifiedPricing.totalSar ?? verifiedPricing.totalBillSar`.
6. **Nested Audit Log Subcollection (`src/lib/adminOrderRequests.ts`, `src/components/AdminOrderRequestsPage.tsx`, `firestore.spark.rules`, `firebase-blueprint.json`)**
   - `defaultAdminOrderRequestStore.setAuditLog` writes to nested `/orderRequests/{requestId}/auditLogs/{logId}`.
   - `subscribeOrderRequestAuditLogs` subscribes per-request to `collection(db, 'orderRequests', requestId, 'auditLogs')`.
   - Audit payloads emit Admin-compatible fields (`actorUid`, `actorEmail`, `actorRole: 'admin'`, `fromStatus`, `toStatus`, `requestReference`, `createdAtIso`) alongside Customer audit fields (`adminUid`, `adminEmail`, `previousStatus`, `newStatus`).
   - `firestore.spark.rules` and `firebase-blueprint.json` declare `/orderRequests/{requestId}/auditLogs/{logId}` (append-only, Admin-only) while retaining legacy `/orderRequestAuditLogs/{auditId}` read/write compatibility.
7. **Customer Test Coverage Updates (`scripts/stage04k.test.ts`, `stage04l.test.ts`, `stage04l1.test.ts`, `stage04m.test.ts`)**
   - Updated mock `verifiedPricing` literals to include `totalSar`, updated `stage04l1.test.ts` to validate dual UIDs against `firestore.spark.rules` (leaving frozen `firestore.rules` untouched), and added Stage 04N.2.4 assertions (`under_review` -> `reviewing`, `requestReference`, `totalSar === totalBillSar`, nested `/orderRequests/{requestId}/auditLogs/{logId}`, `palm-metric-app` config).

## 3. Customer Verification Results (Direct Source & Extracted Archive)
- `npm install --legacy-peer-deps`: EXIT 0 (284 packages)
- `npx tsc --noEmit`: EXIT 0
- `npx vite build`: EXIT 0 (`dist/index.html` + assets built cleanly)
- `node scripts/audit-rules.mjs`: EXIT 0 (PASS)
- `npx tsx scripts/stage04d.test.ts`: 12 passed, 0 failed
- `npx tsx scripts/stage04k.test.ts`: 17 passed, 0 failed
- `npx tsx scripts/stage04l.test.ts`: 20 passed, 0 failed
- `npx tsx scripts/stage04l1.test.ts`: 12 passed, 0 failed
- `npx tsx scripts/stage04m.test.ts`: 9 passed, 0 failed
- **Total Customer Automated Tests:** **70 passed, 0 failed** (plus static `audit-rules.mjs` PASS)

## 4. Restored Customer Archive
- **Filename:** `palm-metric-stage04n24-customer.zip`
- **File Count:** 108 files
- **Size:** 28,099,225 bytes
- **SHA-256:** `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`
- Independently extracted to `/tmp/stage04n24_verify_extract/customer`, byte-for-byte verified (108/108 identical files), installed, built, and all 70 tests + `audit-rules.mjs` passed inside the extracted copy.
