# Firestore Security Specification

## 1. Data Invariants
1. **Menu Items (`/menu/{itemId}`)**: Only verified Admins can create, update, or delete menu items. Non-admin storefront queries may only read `inStock == true` items. Document IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars). `createdAt` is immutable and validated against `request.time`. Category strings are `1..60` chars aligned with `/categories`. Optional `allowMilkOption`, `coconutMilkPrice` (`0..500`), and `allowTemperature` fields are type- and range-checked.
2. **Categories (`/categories/{categoryId}`)**: Only verified Admins can create, update, or delete categories. Non-admin storefront queries may only read `isActive == true` categories.
3. **Store Settings (`/settings/coffeeOptions`)**: Publicly readable (`allow get`) by storefronts so milk surcharge and hot/cold options stay synced; only verified Admins may create or update.
4. **Billboards (`/billboards/{billboardId}`)**: Only verified Admins can create, update, or delete promotional billboards. Non-admin queries may only read `isActive == true` billboards. `mediaType` must be `'image'` or `'video'`.
5. **Orders (`/orders/{orderId}`)**: Contains customer PII (`customerName`, `customerContact`). Blanket reads are forbidden; `get` and `list` are strictly restricted to the order owner (`customerUid == request.auth.uid`) or verified Admin. Order creation enforces `status == 'Pending'`, `customerUid == request.auth.uid`, bounded `items` array (`1..50`), and server timestamps (`request.time`). Only verified Admins may advance or modify order status.
6. **Admins (`/admins/{adminUid}`)**: Only the bootstrapped owners (`tashflow26@gmail.com` or `palmmatric1@gmail.com` or UID `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`) or existing verified admins may read/write admin entries. Users cannot self-assign admin roles.
7. **Media Assets (`/mediaAssets/{assetId}` & `/mediaAssets/{assetId}/chunks/{chunkId}`)**: Only verified Admins may create or delete media assets (`createdBy == request.auth.uid`, immutable after create, bounded `<= 800,000` chars per document and `<= 40` chunks). Parent `isPublic == true` Master Gate governs `get` access on both asset metadata and chunk subcollection; chunk `list` queries are disabled (`allow list: if false`).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated menu write**: `{ "name": "Hacked Latte", ... }` without `request.auth`.
2. **Non-admin menu creation**: Authenticated non-admin attempting `create /menu/abc`.
3. **Ghost field shadow write on menu**: Admin or user sending extra field `isFeatured: true` not in `hasOnly(...)`.
4. **Negative price poisoning**: `{ "price": -5.00 }` or `{ "coconutMilkPrice": -3 }` on `/menu` or `/settings/coffeeOptions`.
5. **Oversized/empty category injection**: `{ "category": "" }` or >60 chars on `/menu`.
6. **ID poisoning (>128 chars)**: Writing to `/menu/` with a 200-char document ID.
7. **Unverified email spoof**: Request with `email: "tashflow26@gmail.com"` and `email_verified: false`.
8. **Inactive billboard leak**: Non-admin attempting `get` or `list` on `/billboards` where `isActive == false`.
9. **Order PII scraping**: Non-admin attempting `list /orders` without `customerUid == request.auth.uid`.
10. **Order identity spoofing**: Customer creating `/orders/{id}` with `customerUid: "other-user-uid"`.
11. **Order status shortcutting on create**: Customer creating `/orders/{id}` with `status: "Completed"`.
12. **Self-assigned admin escalation**: Non-admin attempting `create /admins/$(request.auth.uid)`.

## 3. Red Team Audit Summary
- **Identity Spoofing**: Blocked via `customerUid == request.auth.uid` on create and `incoming().customerUid == existing().customerUid` on update.
- **Email Spoofing**: Blocked via `request.auth.token.email_verified == true` inside `isVerified()`.
- **PII Blanket Protection**: `/orders` restricts `get` and `list` to `customerUid == request.auth.uid` or Admin.
- **Query Trust Test**: All `allow list` rules explicitly evaluate `resource.data` or `isBootstrappedAdmin()` without `get()`/`exists()`.
- **Shadow Updates**: Every `create` uses `hasAll` + `hasOnly`; every `update` uses `isValid[Entity](incoming())` + `affectedKeys().hasOnly(...)`.
