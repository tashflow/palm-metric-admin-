# STAGE 04N.5A — COLLECTION COVERAGE MATRIX

- **Audit Stage:** `04N.5A — Collection Coverage Matrix`
- **Mode:** Strictly Read-Only Specification (Zero Code Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## Complete Collection Coverage Summary

| Path / Collection | Covered in Unified Design? | Customer Access | Admin Access | Validation Function | Status |
|---|---|---|---|---|---|
| **`/menu/{itemId}`** | **YES** | `get`/`list`: `inStock == true`<br>Write: `false` | `get`/`list`/`CRUD`: `isAdmin()` | `isValidMenuItem` | **COVERED** |
| **`/categories/{categoryId}`** | **YES** | `get`/`list`: `isActive == true`<br>Write: `false` | Full CRUD | `isValidCategory` | **COVERED** |
| **`/settings/{settingId}`** | **YES** | `get`: `coffeeOptions`<br>Write: `false` | `coffeeOptions` & `pricing` | `isValidCoffeeOptions`, `isValidPricingSettings` | **COVERED** |
| **`/billboards/{billboardId}`** | **YES** | `get`/`list`: `isActive == true`<br>Write: `false` | Full CRUD | `isValidBillboard` | **COVERED** |
| **`/productCustomizations/{productId}`** | **YES** | `get`/`list`: `enabled == true`<br>Write: `false` | Full CRUD | `isValidProductCustomization` | **COVERED** |
| **`/orderRequests/{requestId}`** | **YES** | `create`: Customer own<br>`get`/`list`: Owner (`customerUid`)<br>`update`/`delete`: `false` | `update`: Admin workflow<br>`delete`: `false` | `isValidOrderRequestCreate`, `isValidOrderRequestAdminUpdate` | **COVERED** |
| **`/orderRequests/{requestId}/auditLogs/{logId}`** | **YES** | **ALL DENIED** (`false`) | `get`/`list`/`create`: Admin only<br>`update`/`delete`: `false` | `isValidOrderRequestAuditLog` | **COVERED** |
| **`/orderRequestAuditLogs/{auditId}`** | **YES** | **ALL DENIED** (`false`) | `get`/`list`/`create`: Admin only<br>`update`/`delete`: `false` | `isValidOrderRequestAuditLog` | **COVERED** |
| **`/orders/{orderId}`** | **YES** | `get`/`list`: Owner (`customerUid`)<br>Write: `false` | `create`: Admin promoted<br>`update`: Status/updatedAt only | `isValidPromotedOrderCreate`, `isValidOrderUpdate` | **COVERED** |
| **`/orderNumbers/{orderNumber}`** | **YES** | **ALL DENIED** (`false`) | `create`: Admin claim<br>`update`/`delete`: `false` | `isValidOrderNumberClaim` | **COVERED** |
| **`/admins/{adminUid}`** | **YES** | `get`: Self only<br>Write: `false` | `get`/`list`: Admin<br>Write: `false` (locked) | `isValidAdminUser` | **COVERED** |
| **`/mediaAssets/{assetId}`** | **YES** | `get`/`list`: `isPublic == true`<br>Write: `false` | `get`/`create`/`delete`: Admin<br>`update`: `false` | `isValidMediaAsset` | **COVERED** |
| **`/mediaAssets/{assetId}/chunks/{chunkId}`** | **YES** | `get`: Parent `isPublic == true`<br>List/Write: `false` | `get`/`create`/`delete`: Admin<br>`update`/`list`: `false` | `isValidMediaChunk` | **COVERED** |
| **`/reports/{reportId}`** | **YES** | `create`: Customer report<br>Read/Write: `false` | `get`/`list`/`update` (status): Admin | `isValidReportCreate`, `isValidReportUpdate` | **COVERED** |
| **`/fcmTokens/{tokenId}`** | **YES** | Owner-scoped CRUD (`uid == auth.uid`) | `get`/`list`: Admin | `isValidFcmToken` | **COVERED** |
| **`/idempotencyKeys/{keyId}`** | **YES** | **ALL DENIED** (`false`) | **ALL DENIED** (`false`) (Server-only) | N/A | **COVERED** |
