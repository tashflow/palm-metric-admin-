# STAGE 04N.2.1 — Cross-Application Contract Verification Report

**Date:** 2026-11-25  
**Customer Source:** `https://github.com/tashflow/Palm-Metric` (`9f265ab`)  
**Admin Source:** `/app/applet` (based on `https://github.com/tashflow/palm-metric-admin-` @ `54e5453` + local Stage 04M.2/04N updates)  

---

## 1. Contract Alignment Matrix

| Contract Area | Customer App Implementation | Admin App Implementation | Status & Findings |
|---|---|---|---|
| **Firebase Project & DB** | `src/lib/firebase.ts`: `palm-metric-app`, `(default)`. Legacy `firebase-applet-config.json` still says `universal-nomad-kwpgt`. | `src/lib/firebase.ts` & `firebase-applet-config.json`: `palm-metric-app`, `(default)`. | **Aligned at Runtime** *(minor metadata cleanup needed in Customer `firebase-applet-config.json`)* |
| **Catalog & Customizations** | Reads `/menu`, `/categories`, `/productCustomizations/{id}`, `/settings/coffeeOptions`, `/settings/pricing`. | Manages `/menu`, `/categories`, `/productCustomizations/{id}`, `/settings/*`. | **Aligned** |
| **Customer Order Requests** | Submits unpriced pickup requests to `/orderRequests/{requestId}` (`status: 'pending_review'`, strips price/admin fields). | Subscribes to `/orderRequests`, normalizes items (`itemId`/`productId`), recalculates from catalog. | **Aligned** |
| **Review Status Transition Enum** | `firestoreSync.ts` & `firestore.spark.rules` expect `'reviewing'` (`'reviewing' \| 'in_review'`). Customer Spark rules do **not** allow `'under_review'`. | `src/lib/orderRequests.ts` & Admin `firestore.spark.rules` write/expect `'under_review'` (normalizer accepts `'reviewing'` -> `'under_review'`). | **Discrepancy Reported** *(Status string `'under_review'` vs `'reviewing'` diverges across the two `firestore.spark.rules` files and Customer tracker mapping)* |
| **Official Order Linkage & Numbers** | Writes `sourceRequestId`, generates `PM-XXXXXX` (FNV-1a), checks `/orderNumbers/{num}` in `firestore.spark.rules`. | Writes `requestId` (`sourceRequestId` not written on `/orders` payload; present only in types), generates `PM-XXXXXX` (FNV-1a), deterministic `ord_<requestId>` doc ID. | **Partial Divergence** *(`requestId` vs `sourceRequestId` across respective `firestore.spark.rules`)* |
| **Authoritative Pricing & Halalas** | Uses integer halalas (`Math.round(sar * 100)`) in `src/lib/authoritativePricing.ts` & `adminOrderRequests.ts`. | Uses integer halalas (`Math.round(sar * 100)`) in `src/lib/authoritativePricing.ts` & `orderRequests.ts`, ignoring client prices and flagging mismatches. | **Aligned** |
| **Inventory Deduction** | `adminOrderRequests.ts` runs `computeStockDeductionPlans` & atomically updates `stockQuantity`/`stockCount` in promotion tx. | `verifyAndPriceOrderRequest` validates stock (`INSUFFICIENT_STOCK` / `OUT_OF_STOCK`), and `authoritativePricing.ts` exports `computeStockDeductionPlans`, **but `src/lib/orderRequests.ts` `approveAndPromoteOrderRequest` does not yet write `/menu` stock decrements in its transaction.** | **Discrepancy Reported** *(Validation matches; runtime stock write in Admin `orderRequests.ts` pending)* |
| **Admin Allowlist & Rules** | `adminAuth.ts` & rules allow UID `39H76y4E55g5yX2uY0lE5bQ3a393` + 4 emails (`palmmetric1`, `palmmatric1`, `tashfilartwork`, `tashflow26`). | `adminAllowlist.ts` removes typo `palmmatric1` & allows both UIDs (`jPgFPc...`, `39H76y...`) + 3 emails; `firestore.spark.rules` has both UIDs + 4 emails; prod `firestore.rules` still has `jPgFPc...` + 2 emails. | **Discrepancy Reported** *(Allowlist sets not yet 100% unified across all 6 files)* |
| **Audit Logs & Idempotency** | Append-only `/orderRequests/{id}/auditLogs`; deterministic `ord_<requestId>` replay safety. | Append-only `/orderRequests/{id}/auditLogs`; deterministic `ord_<requestId>` replay safety & mandatory rejection reasons. | **Aligned** |
