# STAGE 04N.4C — UNIFIED FIRESTORE PERMISSION MATRIX

- **Audit Stage:** `04N.4C — Unified Permission Matrix`
- **Mode:** Strictly Read-Only Specification (Zero Code Mutations)
- **Date:** `2026-11-28`

---

## Unified Permission Matrix (All Paths)

| Collection / Path | Public Get / List | Authenticated Get / List | Customer Owner Get / List | Customer Create / Update / Delete | Verified Admin Get / List / Create / Update / Delete | Explicitly Denied Operations |
|---|---|---|---|---|---|---|
| **`/menu/{itemId}`** | `get`: `inStock == true`<br>`list`: `inStock == true` | Same as public | N/A | **ALL DENIED** (`false`) | **FULL CRUD** (`isAdmin()` / `isVerifiedAdminToken()`) | Customer write/delete; unauthenticated read of out-of-stock items |
| **`/categories/{categoryId}`** | `get`: `isActive == true`<br>`list`: `isActive == true` | Same as public | N/A | **ALL DENIED** (`false`) | **FULL CRUD** | Customer write/delete; reading inactive categories |
| **`/settings/{settingId}`** | `get`: `settingId == 'coffeeOptions'`<br>`list`: **DENIED** | Same as public | N/A | **ALL DENIED** (`false`) | **CRUD** (`coffeeOptions` & `pricing`); `delete: false` | Unauthenticated read of private settings; deleting settings |
| **`/billboards/{billboardId}`** | `get`: `isActive == true`<br>`list`: `isActive == true` | Same as public | N/A | **ALL DENIED** (`false`) | **FULL CRUD** | Customer write/delete; reading inactive billboards |
| **`/productCustomizations/{productId}`** | `get`: `enabled == true`<br>`list`: `enabled == true` | Same as public | N/A | **ALL DENIED** (`false`) | **FULL CRUD** | Customer write/delete; reading disabled configs |
| **`/orderRequests/{requestId}`** | **DENIED** | **DENIED** | `get`: `customerUid == request.auth.uid`<br>`list`: `customerUid == request.auth.uid` | `create`: `isValidOrderRequestCreate`<br>`update`: **`false`**<br>`delete`: **`false`** | **Get/List:** `isVerifiedAdminToken()`<br>**Update:** `isValidOrderRequestAdminUpdate`<br>**Create/Delete:** **`false`** | Customer updating/deleting requests; unauthorized reads |
| **`/orderRequests/{requestId}/auditLogs/{logId}`** | **DENIED** | **DENIED** | **DENIED** | **ALL DENIED** (`false`) | **Get/List:** `isAdmin()`<br>**Create:** `isAdmin()` + `actorUid == auth.uid`<br>**Update/Delete:** **`false`** | Customer read/write; admin update/delete (append-only) |
| **`/orderRequestAuditLogs/{auditId}`** | **DENIED** | **DENIED** | **DENIED** | **ALL DENIED** (`false`) | **Get/List:** `isVerifiedAdminToken()`<br>**Create:** `isAdmin()` + `actorUid == auth.uid`<br>**Update/Delete:** **`false`** | Customer access; admin update/delete |
| **`/orders/{orderId}`** | **DENIED** | **DENIED** | `get`: `customerUid == request.auth.uid`<br>`list`: `customerUid == request.auth.uid` | `create`: **`false`**<br>`update`: **`false`**<br>`delete`: **`false`** | **Get/List/Delete:** `isAdmin()`<br>**Create:** `isAdmin()` + `isValidPromotedOrderCreate`<br>**Update:** `isAdmin()` + `isValidOrderUpdate` + `affectedKeys().hasOnly(['status', 'updatedAt'])` | Customer direct order creation or status mutation |
| **`/orderNumbers/{orderNumber}`** | **DENIED** | **DENIED** | **DENIED** | **ALL DENIED** (`false`) | **Get/List:** `isVerifiedAdminToken()`<br>**Create:** `isAdmin()` + `isValidOrderNumberClaim`<br>**Update/Delete:** **`false`** | Customer access; updating/deleting claim index |
| **`/admins/{adminId}`** | **DENIED** | `get`: `request.auth.uid == adminId`<br>`list`: **DENIED** | Same as auth get | **ALL DENIED** (`false`) | **Get:** `isAdmin() || uid == adminId`<br>**List:** `isVerifiedAdminToken()`<br>**Create/Update/Delete:** **`false`** (Console/Server-only) | Client-side admin role self-assignment |
| **`/mediaAssets/{assetId}` & `/chunks/{chunkId}`** | `get`: `isPublic == true`<br>`list`: `isPublic == true` (chunks list: `false`) | Same as public | N/A | **ALL DENIED** (`false`) | **Get/Create/Delete:** `isAdmin()`<br>**Update:** **`false`** (immutable) | Customer write/update; chunk list |
| **`/reports/{reportId}`** | **DENIED** | **DENIED** | **DENIED** | `create`: `isSignedIn() && isValidReportCreate`<br>`update/delete`: **`false`** | **Get/List/Delete:** `isAdmin()`<br>**Update:** `isAdmin()` + `hasOnly(['status'])` | Customer reading/updating/deleting reports |
| **`/fcmTokens/{tokenId}`** | **DENIED** | **DENIED** | `get`: `uid == request.auth.uid`<br>`list`: `uid == request.auth.uid` | `create/update`: `uid == request.auth.uid`<br>`delete`: `uid == request.auth.uid` | **Get/List:** `isAdmin()`<br>**Create/Update/Delete:** Owner only (`uid == request.auth.uid`) | Cross-user token reads/writes |
| **`/idempotencyKeys/{keyId}`** | **DENIED** | **DENIED** | **DENIED** | **ALL DENIED** (`false`) | **ALL DENIED** (`false`) | Client-side read or write |
