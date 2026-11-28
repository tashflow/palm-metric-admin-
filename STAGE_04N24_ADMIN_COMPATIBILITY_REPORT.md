# STAGE 04N.2.4 — Admin Compatibility Report

## 1. Admin Alignment Scope
Following restoration and verification of the Customer App, the Admin App (`/app/applet`) was audited and updated to enforce full Stage 04N.2.4 contract convergence without introducing extraneous features or altering legacy production `firestore.rules`.

## 2. Admin Changes Applied
1. **Canonical Status Convergence (`src/types/index.ts`, `src/lib/orderRequests.ts`, `src/components/OrderRequestsView.tsx`, `src/components/CustomerStorefrontPreview.tsx`, `src/App.tsx`)**
   - Switched canonical `OrderRequestStatus` from `'under_review'` to **`'reviewing'`**.
   - Updated `normalizeStatus` so `'reviewing'`, `'under_review'`, and `'in_review'` all normalize cleanly to canonical **`'reviewing'`**.
   - Updated `startOrderRequestReview` to emit `status: 'reviewing'`, `reviewStatus: 'in_review'`, and `toStatus: 'reviewing'`.
   - Updated UI badges, status filter counters, queue pending counter, and preview progress tracker to reference `'reviewing'`.
2. **Spark Rules & Blueprint Convergence (`firestore.spark.rules`, `firebase-blueprint.json`)**
   - Updated `isAllowedRequestStatusTransition` so `pending_review` transitions to canonical `'reviewing'` (while keeping `under_review` and `in_review` accepted as legacy `prevStatus` values).
   - Updated `isValidOrderRequestAdminUpdate` so optional `reviewStatus` supports both Admin and Customer admin-store writers cleanly.
   - Updated `/orderRequests/{requestId}/auditLogs/{logId}` rule to accept both `actorUid` and `adminUid` and include `'duplicate_approval_blocked'` / `'verification_blocked'` actions alongside Admin actions.
   - Updated `firebase-blueprint.json` `OrderRequest.properties.status.enum` to `["pending_review", "reviewing", "verified", "rejected", "order_created"]`.
3. **Test Suite Convergence (`scripts/stage04l.test.ts`, `scripts/stage04m.test.ts`)**
   - Updated `stage04l.test.ts` (Tests 04, 05) to assert canonical `'reviewing'`.
   - Updated `stage04m.test.ts` Test 09 to assert legacy `'under_review'` / `'in_review'` -> `'reviewing'` normalization, `totalSar` + `totalBillSar` parity, and stock deduction.
   - Added `stage04m.test.ts` Test 10 verifying `palm-metric-app` / `(default)` config parity, dual Admin UIDs & 4 emails across `adminAllowlist.ts` and `firestore.spark.rules`, canonical `reviewing` transitions, and nested `/orderRequests/{requestId}/auditLogs/{logId}` in `firebase-blueprint.json`.

## 3. Admin Verification Results (Direct & Extracted Archive)
- `npm run lint` (`tsc --noEmit`): EXIT 0
- `npm run build` (`vite build`): EXIT 0 (`dist/index.html` + bundle built in ~1.24s)
- `npm test` (`tsx --test scripts/*.test.ts`): **72 passed, 0 failed** (`stage04l.test.ts`: 19, `stage04m.test.ts`: 10, `stage04n.test.ts`: 43)
- `npx tsx --test src/lib/productCustomizations.test.ts`: **10 passed, 0 failed**
- **Total Admin Automated Tests:** **82 passed, 0 failed**

## 4. Admin Release Archive
- **Filename:** `palm-metric-stage04n24-admin.zip`
- **File Count:** 112 files
- **Size:** 1,927,570 bytes
- **SHA-256:** `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`
- Extracted independently into `/tmp/stage04n24_verify_extract/admin` with 112/112 identical files verified and all 82 tests + lint + build passing inside the extracted copy.
