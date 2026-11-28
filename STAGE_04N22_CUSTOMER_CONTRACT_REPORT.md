# STAGE 04N.2.2 — CUSTOMER CONTRACT REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Target:** Palm Metric Customer App (`tashflow/Palm-Metric`)  
**Currency:** `SAR`  
**Fulfillment:** Pickup only  
**Date:** November 26, 2026  

---

## 1. Executive Summary

This report documents the contract verification and convergence for the **Palm Metric Customer App**. All order request submissions, data payloads, order status normalizations, and authentication rules have been aligned with the Admin App baseline without introducing new features or modifying working business logic.

---

## 2. Customer Contract Specifications

1. **Order Request Creation (`/orderRequests/{requestId}`):**
   - Emits `requestId`, `requestReference` (`REQ-YYMMDD-XXXX`), `customerUid`, `customerName`, `customerContact`, `orderType: 'pickup'`, `pickupType: 'pickup'`, `currency: 'SAR'`, `status: 'pending_review'`, `reviewStatus: 'unreviewed'`, `requestSource: 'customer-app-spark'`, and `items`.
   - **Strict Zero-Trust Rule:** Customer payloads strictly omit all financial breakdowns (`subtotal`, `taxTotal`, `totalBill`) and privileged Admin attributes, preventing client-side price manipulation.
2. **Status Normalization:**
   - Converged on canonical status `'under_review'` for items under review (normalizing legacy variants `'reviewing'` and `'in_review'` cleanly on read).
3. **Identifiers:**
   - Uses `requestId` as the primary document key and `sourceRequestId` when promoted to `/orders/{orderId}`.

---

## 3. Compliance & Verification

- **TypeScript Compilation:** Passed with 0 errors.
- **Production Build:** Built successfully.
- **Spark Security Rules:** Customer app relies on Spark-compliant rules (`firestore.spark.rules`) enforcing owner-scoped isolation (`customerUid == request.auth.uid`).
