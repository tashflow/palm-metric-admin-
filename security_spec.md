# Firestore Security Specification

## 1. Data Invariants
1. **Menu Items (`/menu/{itemId}`)**: Only verified Admins can create, update, or delete menu items. Non-admin storefront queries may only read `inStock == true` items. Document IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars). `createdAt` is immutable and validated against `request.time`. Category strings are `1..60` chars aligned with `/categories`. Optional `allowMilkOption`, `coconutMilkPrice` (`0..500`), and `allowTemperature` fields are type- and range-checked.
2. **Product Customizations (`/productCustomizations/{productId}`)**:
   - Only verified Admins (`isBootstrappedAdmin()` or `/admins/{uid}` via `isAdmin()`) may create, update, or delete customization documents.
   - Public customers may read (`get`/`list`) **only** documents where `enabled == true`; disabled/draft configurations are strictly restricted to verified Admins.
   - Enforces `productId == productId` (matches document ID), `schemaVersion == 1`, `updatedBy == request.auth.uid`, `updatedAt == request.time`, `groups` size `0..8`, `options` size `1..10` per group, `additionalPrice` in `0..500` SAR, valid IDs (`^[a-zA-Z0-9_\-]+$`, `<= 60` chars), bilingual `name` & `nameAr` (`1..80` chars), `type in ['single', 'multiple']`, `minSelections <= maxSelections`, `single => maxSelections == 1`, `required => minSelections >= 1`, and `isDefault => enabled`.
3. **Categories (`/categories/{categoryId}`)**: Only verified Admins can create, update, or delete categories. Non-admin storefront queries may only read `isActive == true` categories.
4. **Store Settings (`/settings/coffeeOptions`)**: Publicly readable (`allow get`) by storefronts so milk surcharge and hot/cold options stay synced; only verified Admins may create or update.
5. **Billboards (`/billboards/{billboardId}`)**: Only verified Admins can create, update, or delete promotional billboards. Non-admin queries may only read `isActive == true` billboards. `mediaType` must be `'image'` or `'video'`.
6. **Orders (`/orders/{orderId}`)**: Contains customer PII (`customerName`, `customerContact`). Blanket reads are forbidden; `get` and `list` are strictly restricted to the order owner (`customerUid == request.auth.uid`) or verified Admin. Order creation enforces `status == 'Pending'`, `customerUid == request.auth.uid`, bounded `items` array (`1..50`), and server timestamps (`request.time`). Only verified Admins may advance or modify order status.
7. **Admins (`/admins/{adminUid}`)**: Only the bootstrapped owners (`tashflow26@gmail.com` or `palmmetric1@gmail.com` with `email_verified == true`, or owner UID `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`) or existing verified admins may read admin entries; only bootstrapped owners may write admin entries. Users cannot self-assign admin roles.
8. **Media Assets (`/mediaAssets/{assetId}` & `/mediaAssets/{assetId}/chunks/{chunkId}`)**: Only verified Admins may create or delete media assets (`createdBy == request.auth.uid`, immutable after create, bounded `<= 800,000` chars per document and `<= 40` chunks). Parent `isPublic == true` Master Gate governs `get` access on both asset metadata and chunk subcollection; chunk `list` queries are disabled (`allow list: if false`).

## 2. Security Audit Remediation (Stage 04B)
- **Removed Arbitrary-Provider Privilege Escalation**: Eliminated `(request.auth.token.firebase.sign_in_provider is string)` from `isBootstrappedAdmin()` in `firestore.rules`, which previously treated ANY authenticated Firebase user (including anonymous/customer accounts) as an administrator.
- **Restored `isVerified()` Enforcement**: Replaced `isSignedIn()` with strict verification requiring `sign_in_provider == 'google.com'` or `email_verified == true`.
- **Verified Email Allowlist Check**: Required `'email_verified' in request.auth.token && request.auth.token.email_verified == true` alongside `tashflow26@gmail.com` / `palmmetric1@gmail.com`, while preserving owner UID `jPgFPc8KbsXaPrdkyrbCQSFDMOP2` so the existing owner is never locked out.

## 3. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated customization/menu write**: Writing `/productCustomizations/{id}` or `/menu/{id}` without `request.auth`.
2. **Customer-as-admin privilege escalation**: Signed-in non-allowlisted user attempting `create /productCustomizations/{id}` or `list /orders` (previously passed via `sign_in_provider is string`).
3. **Ghost field shadow write**: Admin or user sending extra unapproved field (e.g. `serverOverride: true`) not in `hasOnly(...)`.
4. **Negative or excessive price poisoning**: `{ "additionalPrice": -5 }` or `{ "additionalPrice": 9999 }` on `/productCustomizations`, or `{ "price": -5 }` on `/menu`.
5. **Inconsistent selection constraints**: `{ "type": "single", "maxSelections": 2 }` or `{ "required": true, "minSelections": 0 }` or `{ "minSelections": 3, "maxSelections": 1 }` on `/productCustomizations`.
6. **Disabled option marked default**: Option with `{ "enabled": false, "isDefault": true }` on `/productCustomizations`.
7. **Unverified email spoof**: Request with `email: "tashflow26@gmail.com"` and `email_verified: false`.
8. **Disabled customization / inactive billboard leak**: Non-admin attempting `get` or `list` on `/productCustomizations` where `enabled == false` or `/billboards` where `isActive == false`.
9. **Order PII scraping**: Non-admin attempting `list /orders` without `customerUid == request.auth.uid`.
10. **Order identity spoofing**: Customer creating `/orders/{id}` with `customerUid: "other-user-uid"`.
11. **Order status shortcutting on create**: Customer creating `/orders/{id}` with `status: "Completed"`.
12. **Self-assigned admin escalation**: Non-admin attempting `create /admins/$(request.auth.uid)`.

## 4. Red Team Audit Summary
- **Identity Spoofing**: Blocked via `customerUid == request.auth.uid` on orders and `updatedBy == request.auth.uid` on productCustomizations.
- **Email Spoofing**: Blocked via `request.auth.token.email_verified == true` on allowlist checks and inside `isVerified()`.
- **PII Blanket Protection**: `/orders` restricts `get` and `list` to `customerUid == request.auth.uid` or Admin.
- **Shadow Updates**: Every `create` and `update` enforces strict `hasAll` + `hasOnly` field whitelists, doc ID consistency (`data.productId == productId`), and `request.time` timestamps.
