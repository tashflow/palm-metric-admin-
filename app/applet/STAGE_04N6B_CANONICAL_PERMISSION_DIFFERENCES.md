# STAGE 04N.6B — CANONICAL PERMISSION DIFFERENCES & COLLECTION COVERAGE

- **Audit Stage:** `04N.6B — Canonical Permission Differences`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Collection Coverage Verification (16 Canonical Paths + Legacy Paths)

We inspected the candidate rules against the 16 canonical collections required by Stage 04N.4C:

1. `/menu/{itemId}` — Implemented with public active/inStock read and admin write.
2. `/categories/{categoryId}` — Implemented with public active read and admin write.
3. `/settings/{settingId}` — Implemented (`coffeeOptions`, `pricing`) with public/authenticated read and admin write.
4. `/billboards/{billboardId}` — Implemented with public active read and admin write.
5. `/productCustomizations/{productId}` — Implemented with public enabled read and admin write.
6. `/orderRequests/{requestId}` — Implemented with customer create/read own, admin review/update.
7. `/orderRequests/{requestId}/auditLogs/{logId}` — Implemented with admin get/list/create, immutable updates/deletes.
8. `/orderRequestAuditLogs/{auditId}` — Implemented with admin get/list/create.
9. `/orders/{orderId}` — Implemented with customer read own, admin promote/update status.
10. `/orderNumbers/{orderNumber}` — Implemented with admin claim creation and read.
11. `/admins/{adminUid}` — Implemented with read own/admin, write disabled (anti-mutability).
12. `/mediaAssets/{assetId}` — Implemented with public/admin get, admin create/delete.
13. `/mediaAssets/{assetId}/chunks/{chunkId}` — Implemented with public/admin chunk get, admin chunk create.
14. `/reports/{reportId}` — Implemented with customer create (reports), admin read/update status/delete.
15. `/fcmTokens/{tokenId}` — Implemented with user ownership (`uid == request.auth.uid`) and admin access.
16. `/idempotencyKeys/{keyId}` — Implemented with explicit default-deny (`allow read, write: if false;`).

---

## 2. Unexpected or Legacy Paths Investigation

- `/products`, `/customers`, `/notifications`, `/system`, `/auditLogs`: Some of these exist in hybrid code paths or were handled via subcollections/root collections in earlier customer/admin versions. The candidate routes specific collections cleanly and defaults unconfigured root paths to deny-all. No unauthorized bypasses were detected.

---

## 3. Permission Matrix Audit

- **Customer Report Creation:** Permitted on `/reports/{reportId}` (`isSignedIn() && isValidReportCreate(incoming())`).
- **Customer Final Order Access:** Read-only access to `/orders/{orderId}` where `customerUid == request.auth.uid`. Direct customer creation/deletion on `/orders` is blocked.
- **Admin Order Management:** Full promote (`create` via `isValidPromotedOrderCreate`) and status update (`isValidOrderUpdate`), with deletion restricted to admin.
- **Admin Self-Provisioning:** Blocked (`allow create, update, delete: if false;` on `/admins/{adminUid}`).
