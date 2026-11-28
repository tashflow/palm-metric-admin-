# STAGE 04N.2.7 — Admin Contract Verification Report

**Audit Stage:** Stage 04N.2.7 (Strictly Read-Only Source & Config Inspection)  
**Target Workspace:** `/app/applet` (matches Identity B `palm-metric-stage04n24-admin.zip` `112/112`)

---

## 1. Firebase Project & Database Alignment

- `firebase-applet-config.json`: `projectId: "palm-metric-app"`, `firestoreDatabaseId: "(default)"`, `appId: "1:522581928710:web:993ecee99d938707fc8c87"`, `authDomain: "palm-metric-app.firebaseapp.com"`, `storageBucket: "palm-metric-app.firebasestorage.app"`, `messagingSenderId: "522581928710"`.
- `src/lib/firebase.ts:32-41`: Initializes `palm-metric-app` and `getFirestore(...)` matching `firebase-applet-config.json` with zero modifications.

---

## 2. Eight Contract Verification Results

| # | Contract Area | Exact Source / Rule / Blueprint Locations (`/app/applet`) | Status |
|---|---|---|---|
| 1 | Canonical intermediate order status `"reviewing"` | `src/types/index.ts:204,211`; `src/lib/orderRequests.ts:114,117,152,438-474`; `src/components/OrderRequestsView.tsx:65,110,183,966`; `src/App.tsx:317`; `firestore.spark.rules:253`; `firebase-blueprint.json:479` | **VERIFIED** |
| 2 | Legacy normalization (`"under_review"` & `"in_review"`) | `src/lib/orderRequests.ts:114-117` normalizes `'reviewing' \| 'under_review' \| 'in_review'` -> `'reviewing'`; `firestore.spark.rules:254,259,335` accepts legacy `'under_review'` / `'in_review'` prevStatus | **VERIFIED** |
| 3 | Customer `"requestReference"` compatibility | `src/types/index.ts:194,359,384`; `src/lib/orderRequests.ts:92,95,172-173,279`; `src/components/OrderRequestsView.tsx:200,555,634,1075,1081`; `firestore.spark.rules:224,232,266,327`; `firebase-blueprint.json:262,466` | **VERIFIED** |
| 4 | Immutable `"sourceRequestId"` handling | `src/types/index.ts:192`; `src/lib/orderRequests.ts:625,646,768,913`; `firestore.spark.rules:305,313,325-341,368` (`data.sourceRequestId == existing().sourceRequestId`); `firebase-blueprint.json:257` | **VERIFIED** |
| 5 | `"verifiedPricing.totalSar"` & `"totalBillSar"` parity | `src/types/index.ts:314,317,318`; `src/lib/orderRequests.ts:256-271` emits & resolves both `totalSar` and `totalBillSar` from halalas; `firestore.spark.rules:280-282,303` | **VERIFIED** |
| 6 | Approved Admin UID & email allowlist parity | `src/lib/adminAllowlist.ts:2-10` & `firestore.spark.rules:53-63` enforce both UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and all 4 emails (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`) | **VERIFIED** |
| 7 | Nested order request audit-log compatibility | `src/lib/orderRequests.ts:827,1128,1194` reads/writes `/orderRequests/{requestId}/auditLogs/{logId}`; `src/components/OrderRequestsView.tsx:104,269,271`; `firestore.spark.rules:15,463`; `firebase-blueprint.json:572` | **VERIFIED** |
| 8 | Authorized inventory deduction via approved transaction | `src/lib/orderRequests.ts:820-858` atomically deducts `stockQuantity`/`stockCount` and flips `inStock=false` at `0` inside `runTransaction` (verified via mock-tx unit tests; live Firestore Emulator blocked by `NO_JAVA`) | **VERIFIED (IN-MEMORY TX)** |
