# STAGE 04N.2.6 — Customer Source & Configuration Identity Report

**Audit Stage:** Stage 04N.2.6 (Read-Only Inspection)  
**Important Workspace Scope Disclosure:** `/app/applet` is the **Admin App** (`Verda Admin`) workspace; no live Customer App source tree is mounted at `/app/applet`. All source/configuration identity checks below were executed directly against the extracted source tree of the sole Stage 04N.2.4 Customer archive present on disk: **`palm-metric-stage04n24-customer.zip`** (Identity B, `108` files, SHA-256 `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`). Identity A (`f98e5646...`, `143` files) could not be inspected because it is unavailable.

---

## 1. Customer Identity Metadata (`palm-metric-stage04n24-customer.zip`)

- `metadata.json`: `"name": "Verdant — Specialty Coffee & Kitchen"` (SHA-256 `a5b0a63b4938ccda4d1142d8336b53cbe3380e2bbf5b3c461b6526d6850dabb3`)
- `firebase-applet-config.json` (SHA-256 `807ebb8e20e0aa82dcec5bf194ca433a4122f5e91a035325f7d5bb8720bf526c`):
  - `projectId`: `"palm-metric-app"`
  - `firestoreDatabaseId`: `"(default)"`
  - `appId`: `"1:522581928710:web:993ecee99d938707fc8c87"`
  - `authDomain`: `"palm-metric-app.firebaseapp.com"`
  - `storageBucket`: `"palm-metric-app.firebasestorage.app"`
  - `messagingSenderId`: `"522581928710"`
- `src/lib/firebase.ts` (lines 23–34): Initializes directly against `projectId: 'palm-metric-app'` (`getFirestore(app)`).
- *(Contrast against superseded `04n22`/`04n21`/`04n2` Customer ZIPs: those earlier packages still had `universal-nomad-kwpgt` / `ai-studio-d605dbc1-6b60-4f95-aa23-547f79d7d4d8` in `firebase-applet-config.json`.)*

---

## 2. Verification of the Eight Stage 04N.2.4 Contract Items

| # | Contract Item | Observed Customer Evidence (`palm-metric-stage04n24-customer.zip`) | Status |
|---|---|---|---|
| 1 | Canonical intermediate order status `"reviewing"` | `src/types.ts:153` defines `'reviewing'`; `src/lib/adminOrderRequests.ts:352,368,382,390` transitions `pending_review -> 'reviewing'`; `firestore.spark.rules:384` restricts `data.status` to `['pending_review', 'reviewing', 'verified', 'order_created', 'approved', 'rejected', 'cancelled']` | **VERIFIED IN IDENTITY B** |
| 2 | Legacy normalization of `"under_review"` & `"in_review"` | `src/lib/firestoreSync.ts:954` normalizes `val === 'reviewing' \|\| val === 'in_review' \|\| val === 'under_review'` to `'reviewing'`; `firestore.spark.rules:357` accepts existing `['pending_review', 'reviewing', 'under_review', 'in_review', 'verified']` | **VERIFIED IN IDENTITY B** |
| 3 | `"requestReference"` | `src/lib/firestoreSync.ts:725,906,910,1028-1037,1241` emits & maps `REQ-...`; `src/lib/adminOrderRequests.ts:218,231,235,263-269,763`; `firestore.spark.rules:328,339,373` enforces `^REQ-[a-zA-Z0-9_\-]+$` | **VERIFIED IN IDENTITY B** |
| 4 | Immutable `"sourceRequestId"` | `src/types.ts:315`; `src/lib/firestoreSync.ts:1240`; `src/lib/adminOrderRequests.ts:572-584,627-637,762`; `firestore.spark.rules:421,490-509,527,555` enforces `sourceRequestId == existing().sourceRequestId` & links `ord_<sourceRequestId>` | **VERIFIED IN IDENTITY B** |
| 5 | `"verifiedPricing.totalSar"` & `"totalBillSar"` | `src/types.ts:206-207`; `src/lib/firestoreSync.ts:1008-1020` resolves `totalSar ?? totalBillSar` & sets both; `src/components/OrderTrackerPage.tsx:722`; `src/lib/adminOrderRequests.ts:750,753`; `firestore.spark.rules:397-401` enforces equality | **VERIFIED IN IDENTITY B** |
| 6 | Approved Admin UID & email allowlist parity | `src/lib/adminAuth.ts:4-12` & `firestore.spark.rules:42-48` contain both UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and all 4 emails (`palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`, `tashflow26@gmail.com`) | **VERIFIED IN IDENTITY B** |
| 7 | Nested `"/orderRequests/{requestId}/auditLogs/{logId}"` | `src/lib/adminOrderRequests.ts:189,1107,1124` writes & subscribes `/orderRequests/{requestId}/auditLogs/{logId}`; `firestore.spark.rules:699` & `firebase-blueprint.json` declare append-only Admin subcollection | **VERIFIED IN IDENTITY B** |
| 8 | Authorized inventory deduction via approved transaction | `src/lib/adminOrderRequests.ts:283-305,805` (`buildUpdatedMenuStockPayload`) atomically updates `stockQuantity` / `stockCount` & flips `inStock: false` at `0` inside `runTransaction` | **VERIFIED IN IDENTITY B** |

---

## 3. Source Identity Gap

Live Customer workspace (`/app/applet` in `tashflow/Palm-Metric`) and Identity A (`f98e5646...`) remain **unverified** because neither is accessible in this Admin container.
