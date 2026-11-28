# STAGE 04N.7C — TRANSACTION TEST MATRIX

- **Audit Stage:** `04N.7C — Transaction Test Matrix`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## Transaction & Atomic Consistency Test Matrix

| Transaction Step | Target Path | Rule Validation Logic | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **1. Read Request** | `/orderRequests/{requestId}` | `exists()` & `get()` | ALLOW if request exists and pending/verified. |
| **2. Read Order Number** | `/orderNumbers/{orderNumber}` | `!exists()` (pre-check) | ALLOW if order number is unassigned. |
| **3. Create Order** | `/orders/ord_{requestId}` | `isValidPromotedOrderCreate()` + `existsAfter()` / `getAfter()` | ALLOW if linked to request and order number. |
| **4. Claim Order Number**| `/orderNumbers/{orderNumber}` | `isValidOrderNumberClaim()` + `existsAfter()` | ALLOW if points to created order. |
| **5. Update Request** | `/orderRequests/{requestId}` | `isValidOrderRequestAdminUpdate()` + `existsAfter()` | ALLOW if status updated to `order_created` and points to new order. |
