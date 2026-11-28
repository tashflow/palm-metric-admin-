# STAGE 04N.2.2 — ADMIN CONTRACT REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Target:** Palm Metric Admin App (`tashflow/palm-metric-admin-`)  
**Currency:** `SAR`  
**Fulfillment:** Pickup only  
**Date:** November 26, 2026  

---

## 1. Executive Summary

This report documents the contract verification and convergence for the **Palm Metric Admin App**. All order verification workflows, authoritative SAR pricing engines, atomic inventory deduction handlers, order number claim registries, and admin allowlists have been reconciled and verified with 100% test pass rates (71/71 tests passed).

---

## 2. Admin Contract Specifications & Discrepancy Resolutions

1. **Order Status (Discrepancy A):**
   - Canonical status is `'under_review'`. Both apps and Spark rules normalize legacy `'reviewing'` and `'in_review'` values to `'under_review'` on read and reject writing `'reviewing'` as new state transitions.
2. **Order Document Identifiers (Discrepancy B):**
   - Established canonical `sourceRequestId` on `/orders/{orderId}` (with `orderId == 'ord_' + sourceRequestId`) while maintaining backward compatibility with `requestId` and tolerating legacy fields during idempotent replay.
3. **Inventory Management (Discrepancy C):**
   - Atomic stock deduction via `computeStockDeductionPlans` runs strictly within the Firestore transaction context (`updateMenuDoc`).
   - Managed stock (`stockQuantity` or `stockCount`) is decremented exactly once upon approval.
   - Reached zero stock automatically flips `inStock: false` and related availability flags.
   - Rejected and cancelled orders do not consume stock.
4. **Admin Allowlist (Discrepancy D):**
   - Reconciled all allowlist references across `adminAllowlist.ts`, `firebase.ts`, `AuthContext.tsx`, and `firestore.spark.rules` to consistently contain **4 canonical emails** (`'tashflow26@gmail.com'`, `'palmmetric1@gmail.com'`, `'palmmatric1@gmail.com'`, `'tashfilartwork@gmail.com'`) and **2 UIDs** (`'jPgFPc8KbsXaPrdkyrbCQSFDMOP2'`, `'39H76y4E55g5yX2uY0lE5bQ3a393'`).
   - Hardened `AuthContext.tsx` to require email verification (`emailVerified || tokenEmailVerified || isBootstrappedUid`) so unverified email matches fail closed.

---

## 3. Test & Build Verification

- **Automated Tests:** 71 tests passed, 0 failed.
- **TypeScript Compilation:** Passed cleanly.
- **Production Build:** Successful.
