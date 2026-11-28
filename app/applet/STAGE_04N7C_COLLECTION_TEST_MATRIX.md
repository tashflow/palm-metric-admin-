# STAGE 04N.7C — COLLECTION TEST MATRIX

- **Audit Stage:** `04N.7C — Collection Test Matrix`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## Comprehensive Collection & Subcollection Test Cases

| Collection Path | Role | Operation | Expected Outcome | Test Case Description |
| :--- | :--- | :--- | :--- | :--- |
| `/menu/{itemId}` | Unauthenticated | Read | DENY | Public can only read inStock items. |
| `/menu/{itemId}` | Customer | Create/Update | DENY | Customers cannot modify menu. |
| `/menu/{itemId}` | Verified Admin | Create/Update | ALLOW | Admins can create valid menu items. |
| `/orderRequests/{requestId}` | Customer | Create | ALLOW | Customer creates own valid request. |
| `/orderRequests/{requestId}` | Customer | Create | DENY | Customer creates request with forged UID. |
| `/orderRequests/{requestId}` | Admin | Update | ALLOW | Admin approves / promotes request. |
| `/orders/{orderId}` | Customer | Create | DENY | Customers cannot directly create official orders. |
| `/orders/{orderId}` | Customer | Read | ALLOW | Customer reads own official order. |
| `/orders/{orderId}` | Admin | Create | ALLOW | Admin promotes order via transaction. |
| `/admins/{adminUid}` | Admin / User | Create/Update/Delete | DENY | Unconditional anti-mutability rule. |
| `/fcmTokens/{tokenId}` | Customer | Write | ALLOW | Customer registers own FCM token. |
| `/reports/{reportId}` | Customer | Create | ALLOW | Customer submits feedback / report. |
| `/reports/{reportId}` | Customer | Read | DENY | Customers cannot read submitted reports. |
