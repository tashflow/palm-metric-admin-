# Palm Metric — Stage 04M.2 Shared Firebase Contract & Blueprint

## 1. Executive Summary
This document defines the unified Firebase Firestore data contract, collection schemas, currency standards, and security rules shared between the Palm Metric Customer App and Admin App under Stage 04M.2.

## 2. Environment & Project Metadata
- **Firebase Project ID**: `palm-metric-app`
- **Firestore Database**: `(default)`
- **Cloud Functions**: None (Zero-Cloud-Functions Spark Plan architecture).
- **Currency**: SAR (Saudi Riyal), stored internally in integer halalas (SAR * 100) to prevent floating-point rounding errors.
- **Order Fulfillment**: Pickup only.

## 3. Firestore Collection Schema Contract
1. **`/orderRequests/{requestId}`**:
   - Created by: Customer App (authenticated user).
   - Fields: `requestId`, `customerUid`, `customerEmail`, `items` (array of product ID, title, base price, selected options, quantity), `clientSubtotal`, `clientTotal`, `status` (`pending_review`, `under_review`, `approved`, `rejected`), `createdAt`, `pickupTime`, `customerNotes`.
2. **`/orders/{orderId}`**:
   - Created by: Admin App (via atomic transaction upon approval).
   - Fields: `orderId`, `sourceRequestId`, `customerUid`, `customerEmail`, `items`, `verifiedPricing` (subtotal, discount, tax, total in halalas), `status` (`approved`, `preparing`, `ready`, `completed`, `cancelled`), `approvedAt`, `approvedBy`, `createdAt`.
3. **`/productCustomizations/{productId}`**:
   - Managed by: Admin Dashboard.
   - Fields: customization groups, option names, surcharges in halalas, enabled status, min/max selections.
4. **`/products/{productId}`**:
   - Fields: `name`, `price` (halalas), `stockQuantity` / `stockCount`, `category`, `imageUrl`, `isAvailable`.
5. **`/auditLogs/{logId}`**:
   - Managed by: Admin Dashboard.
   - Fields: `action`, `actorEmail`, `actorUid`, `targetId`, `timestamp`, `details`.
6. **`/admins/{adminId}`**:
   - Read-only security directory listing authorized admin UIDs and emails.

## 4. Security Rules (`firestore.spark.rules`)
- Strict role-based access control ensuring customers can only create and read their own order requests, while authorized admins (validated by allowlist and UID check) can review, approve, reject, manage inventory, and write audit logs.
- Production `firestore.rules` remain untouched.
