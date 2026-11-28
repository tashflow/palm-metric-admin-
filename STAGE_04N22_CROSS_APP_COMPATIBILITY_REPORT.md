# STAGE 04N.2.2 — CROSS-APP COMPATIBILITY REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Currency:** `SAR`  
**Fulfillment:** Pickup only  
**Date:** November 26, 2026  

---

## 1. Executive Summary

This report verifies the end-to-end compatibility between the Palm Metric Customer App and the Palm Metric Admin App under the Stage 04N.2.2 converged contract.

---

## 2. End-to-End Workflow Verification

1. **Customer Checkout:** Customer App creates an order request in `/orderRequests/{requestId}` with status `'pending_review'`, `pickupType: 'pickup'`, and zero financial fields.
2. **Admin Review & Verification:** Admin App reads `/orderRequests/{requestId}`, transitions status to `'under_review'`, executes authoritative SAR pricing (`authoritativePricing.ts`), and verifies product availability.
3. **Atomic Approval & Promotion:** Admin approves the request. The transaction atomically:
   - Allocates a unique, collision-checked `PM-XXXXXX` order number via `/orderNumbers/{orderNumber}`.
   - Deducts managed inventory atomically on `/menu/{itemId}`.
   - Creates the official order doc in `/orders/ord_<requestId>` linking `sourceRequestId` and `requestReference`.
   - Updates the request status to `'order_created'` and records audit entries in `/orderRequests/{requestId}/auditLogs`.
4. **Customer Order Tracking:** Customer App reads the promoted order and request state via security rules enforcing `customerUid` isolation.

---

## 3. Interoperability Safeguards

- **Zero-Trust Payloads:** Client-submitted pricing is ignored; Admin pricing engine takes absolute precedence.
- **Idempotent Replay:** Repeated promotion calls return the existing promoted order safely without double-deducting stock or duplicating orders.
