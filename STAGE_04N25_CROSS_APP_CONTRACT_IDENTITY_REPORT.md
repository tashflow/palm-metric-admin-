# STAGE 04N.2.5 — Cross-App Contract & Identity Report

**Audit Stage:** Stage 04N.2.5 (Direct Line-Level Verification on Extracted Archives)  
**Verified Pairs Compared:**
- Customer Extract: `/tmp/stage04n25_audit/customer` (`palm-metric-stage04n24-customer.zip`, `d01917c4...`, `108` files)
- Admin Extract / Workspace: `/tmp/stage04n25_audit/admin` & `/app/applet` (`palm-metric-stage04n24-admin.zip`, `be072ce3...`, `112` files)

---

## 1. Line-by-Line Contract Convergence Table

| Contract Item | Customer Source Evidence | Admin Source Evidence | Status |
|---|---|---|---|
| **1. Firebase Project & DB** | `firebase-applet-config.json` & `src/lib/firebase.ts:23-28` -> `projectId: 'palm-metric-app'`, `firestoreDatabaseId: '(default)'` | `firebase-applet-config.json` & `src/lib/firebase.ts:32-34` -> `projectId: 'palm-metric-app'`, `firestoreDatabaseId: '(default)'` | **VERIFIED ALIGNED** |
| **2. Canonical Status (`reviewing`) & Legacy Normalization** | `src/types.ts:153` (`'reviewing'`); `src/lib/firestoreSync.ts:954` maps `'reviewing' \| 'in_review' \| 'under_review'` -> `'reviewing'`; `src/lib/adminOrderRequests.ts:352,368,382,390` | `src/types/index.ts:204,211` (`'reviewing'`); `src/lib/orderRequests.ts:114-117` normalizes `'reviewing' \| 'under_review' \| 'in_review'` -> `'reviewing'`; `startOrderRequestReview` lines `438-474`; `firestore.spark.rules:253-254` | **VERIFIED ALIGNED** |
| **3. `requestReference` & Immutable `sourceRequestId`** | `src/lib/firestoreSync.ts:906-910,1028-1037,1240-1241`; `src/lib/adminOrderRequests.ts:231-235,572-584,627-637,762-763`; `firestore.spark.rules:328,339,373,490-509,555` | `src/lib/orderRequests.ts:172-173,279,768-769,913-914`; `firestore.spark.rules:224-232,266,325-341,368-369` | **VERIFIED ALIGNED** |
| **4. Authoritative Pricing (`totalSar` & `totalBillSar`)** | `src/types.ts:206-207`; `src/lib/firestoreSync.ts:1008-1020` resolves & populates `totalSar` and `totalBillSar`; `src/components/OrderTrackerPage.tsx:722`; `firestore.spark.rules:397-401` | `src/types/index.ts:317-318`; `src/lib/orderRequests.ts:256-271` emits & resolves `totalSar` and `totalBillSar`; `firestore.spark.rules:280-282,303` | **VERIFIED ALIGNED** |
| **5. Nested Audit Logs Subcollection** | `src/lib/adminOrderRequests.ts:189,1107,1124` writes/subscribes `/orderRequests/{requestId}/auditLogs/{logId}`; `firestore.spark.rules:699`; `firebase-blueprint.json` | `src/lib/orderRequests.ts:827,1128,1194` writes/subscribes `/orderRequests/{requestId}/auditLogs/{logId}`; `firestore.spark.rules:463`; `firebase-blueprint.json` | **VERIFIED ALIGNED** |
| **6. Admin Allowlist UIDs (Dual)** | `src/lib/adminAuth.ts:11-12` & `firestore.spark.rules:48` include `'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'` and `'39H76y4E55g5yX2uY0lE5bQ3a393'` | `src/lib/adminAllowlist.ts:9-10` & `firestore.spark.rules:53` include `'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'` and `'39H76y4E55g5yX2uY0lE5bQ3a393'` | **VERIFIED ALIGNED** |
| **7. Admin Allowlist Emails (All 4)** | `src/lib/adminAuth.ts:4-7` & `firestore.spark.rules:42-45` (`palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`, `tashflow26@gmail.com`) | `src/lib/adminAllowlist.ts:2-5` & `firestore.spark.rules:60-63` (exact same 4 emails) | **VERIFIED ALIGNED** |
| **8. Atomic Stock Deduction & Rollback** | `src/lib/adminOrderRequests.ts:280-310` & transaction promotion commit updates `stockQuantity`/`stockCount` and flips `inStock=false` at `0` atomically | `src/lib/orderRequests.ts:820-858` atomically deducts `stockQuantity`/`stockCount` and flips `inStock=false` at `0` inside `runTransaction` | **VERIFIED ALIGNED (via unit/mock-tx; live Emulator blocked)** |

---

## 2. Unresolved External Identity Risk

While all 8 contract dimensions are **100% converged** between `palm-metric-stage04n24-customer.zip` and `palm-metric-stage04n24-admin.zip` (Set B), the competing external Conflict Set A archives (`f98e5646...` Customer `143` files and `c00e9e4c...` Admin `64` files) are **absent from disk** and therefore cannot be inspected at source level from this container.
