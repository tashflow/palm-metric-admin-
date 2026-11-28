# STAGE 04N.4C — ORDER & INVENTORY SECURITY INVARIANTS

- **Audit Stage:** `04N.4C — Order & Inventory Security Invariants`
- **Mode:** Strictly Read-Only Specification (Zero Code Mutations)
- **Date:** `2026-11-28`

---

## 1. Core Invariants (`INV-01` through `INV-10`)

1. **`INV-01` — Customers Can Only Create Their Own `pending_review` Request:**
   - Enforced via `/orderRequests/{requestId}` `create` rule requiring `isSignedIn() && customerUid == request.auth.uid`, `status == 'pending_review'`, `reviewStatus == 'unreviewed'`, and `createdAt == updatedAt == request.time`.
2. **`INV-02` — Customers Cannot Create Final `/orders`:**
   - Enforced via `/orders/{orderId}` `create` rule requiring `isAdmin() && isValidPromotedOrderCreate(...)`. All customer and anonymous writes are blocked (`PERMISSION_DENIED`).
3. **`INV-03` — Customers Cannot Set Authoritative Prices or Totals:**
   - Customer-submitted estimates (`clientEstimatedTotal`) are strictly informational. Authoritative totals are computed inside Admin `verifyAndPriceOrderRequest()` using server catalog data.
4. **`INV-04` — Admin Approval Must Revalidate Menu, Pricing, and Customizations:**
   - `approveAndPromoteOrderRequest()` re-reads catalog documents inside `runTransaction` and runs `verifyAndPriceOrderRequest()` before committing an official order.
5. **`INV-05` — Atomic Promotion Transaction:**
   - Order creation, order number claiming (`/orderNumbers`), request status update (`/orderRequests`), inventory deduction (`/menu`), and audit logging (`/auditLogs`) are executed atomically in a single Firestore `runTransaction`.
6. **`INV-06` — Immutable `sourceRequestId` and `customerUid`:**
   - Enforced by `isValidPromotedOrderCreate` and `isValidOrderUpdate` rules requiring `sourceRequestId` and `customerUid` to remain strictly identical to `existing()` during any order update.
7. **`INV-07` — Duplicate Promotion Prevention:**
   - Deterministic target ID `ord_<requestId>` combined with `!exists(/orders/$(orderId))` and terminal request state guards prevents duplicate official orders or double inventory deductions.
8. **`INV-08` — Customer Order Status Immobility:**
   - Customers have zero `update` or `delete` permissions on `/orders` and `/orderRequests`.
9. **`INV-09` — Authorized Stock Decrements Only:**
   - Managed stock (`stockQuantity`/`stockCount`) is decremented exclusively during authorized Admin order promotion transactions, flipping `inStock: false` when stock reaches `0`.
10. **`INV-10` — Cross-Document Invariant Proofs (`getAfter`/`existsAfter`):**
    - Rules enforce cryptographic-style linkage verifying that `approvedOrderId == 'ord_' + requestId`, that the source order request status transitions to `order_created`, and that `/orderNumbers` claims match the promoted order.
