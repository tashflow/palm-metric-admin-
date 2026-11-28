# STAGE 04N.5A — UNIFIED FIRESTORE RULES DESIGN

- **Audit Stage:** `04N.5A — Unified Rules Design`
- **Mode:** Strictly Read-Only Design & Static Specification (Zero Code or Rules Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Backend Architecture:** Firebase Spark Free (Zero Cloud Functions)
- **Confirmed Workspace Identity:** `/app/applet` is Palm Metric Admin App (`Verda Admin`); Customer evidence sourced from verified Identity B archive (`palm-metric-stage04n24-customer.zip`, SHA-256 `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`).
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Unified Rules Design Architecture

This document presents the complete design specification for a single, unified Firestore Security Rules candidate (`DRAFT_unified_firestore.rules`) reconciling both Palm Metric Customer and Admin applications for project `palm-metric-app` `(default)`.

### Core Helper Functions & Authorization Architecture:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Global Safety Net: Default-deny all unconfigured paths
    match /{document=**} {
      allow read, write: if false;
    }

    // Core Primitives
    function isValidId(id) {
      return id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isNonAnonymousUser() {
      return isSignedIn()
        && (!('firebase' in request.auth.token)
            || !('sign_in_provider' in request.auth.token.firebase)
            || request.auth.token.firebase.sign_in_provider != 'anonymous');
    }

    function isVerifiedAdminToken() {
      return isNonAnonymousUser() && (
        request.auth.uid in ['jPgFPc8KbsXaPrdkyrbCQSFDMOP2', '39H76y4E55g5yX2uY0lE5bQ3a393'] ||
        (
          'email' in request.auth.token &&
          request.auth.token.email is string &&
          'email_verified' in request.auth.token &&
          request.auth.token.email_verified == true &&
          request.auth.token.email.lower() in [
            'tashflow26@gmail.com',
            'palmmetric1@gmail.com',
            'palmmatric1@gmail.com',
            'tashfilartwork@gmail.com'
          ]
        )
      );
    }

    function isAdmin() {
      return isVerifiedAdminToken() || (
        isNonAnonymousUser()
        && 'email_verified' in request.auth.token
        && request.auth.token.email_verified == true
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid))
      );
    }
```

---

## 2. Collection-by-Collection Unified Rules Specification

### 1. `/menu/{itemId}`
- **Get / List:** `allow get: if isValidId(itemId) && (isAdmin() || ('inStock' in existing() && existing().inStock == true));`<br>`allow list: if isVerifiedAdminToken() || ('inStock' in resource.data && resource.data.inStock == true);`
- **Create / Update:** `allow create, update: if isValidId(itemId) && isAdmin() && isValidMenuItem(incoming());`
- **Delete:** `allow delete: if isValidId(itemId) && isAdmin();`

### 2. `/categories/{categoryId}`
- **Get / List:** `allow get: if isValidId(categoryId) && (isAdmin() || ('isActive' in existing() && existing().isActive == true));`<br>`allow list: if isVerifiedAdminToken() || ('isActive' in resource.data && resource.data.isActive == true);`
- **Create / Update / Delete:** Admin only with `isValidCategory(incoming())`.

### 3. `/settings/{settingId}`
- **Get:** `allow get: if settingId == 'coffeeOptions' || isAdmin();`
- **List:** `allow list: if isVerifiedAdminToken();`
- **Create / Update:** `allow create, update: if isAdmin() && ((settingId == 'coffeeOptions' && isValidCoffeeOptions(incoming())) || (settingId == 'pricing' && isValidPricingSettings(incoming())));`
- **Delete:** `allow delete: if false;`

### 4. `/billboards/{billboardId}`
- **Get / List:** Gated to `isActive == true` for non-admins, full read for Admin.
- **Create / Update / Delete:** Admin only with `isValidBillboard(incoming())`.

### 5. `/productCustomizations/{productId}`
- **Get / List:** Gated to `enabled == true` for non-admins, full read for Admin.
- **Create / Update / Delete:** Admin only with `isValidProductCustomization(incoming(), productId)`.

### 6. `/orderRequests/{requestId}`
- **Get / List:** `allow get: if isValidId(requestId) && isSignedIn() && (isAdmin() || ('customerUid' in existing() && existing().customerUid == request.auth.uid));`<br>`allow list: if isSignedIn() && (isVerifiedAdminToken() || ('customerUid' in resource.data && resource.data.customerUid == request.auth.uid));`
- **Create:** `allow create: if isValidId(requestId) && isSignedIn() && isValidOrderRequestCreate(incoming(), requestId);`
- **Update:** `allow update: if isValidId(requestId) && isAdmin() && isValidOrderRequestAdminUpdate(requestId, incoming(), existing());`
- **Delete:** `allow delete: if false;`

### 7. `/orderRequests/{requestId}/auditLogs/{logId}` & `/orderRequestAuditLogs/{auditId}`
- **Read:** `isAdmin()` / `isVerifiedAdminToken()`.
- **Create:** Admin only (`incoming().actorUid == request.auth.uid && createdAt == request.time`).
- **Update / Delete:** `allow update, delete: if false;` (Append-only).

### 8. `/orders/{orderId}`
- **Get / List:** Owner-scoped (`customerUid == request.auth.uid`) or Admin.
- **Create:** `allow create: if isValidId(orderId) && isAdmin() && isValidPromotedOrderCreate(orderId, incoming());` (Blocks all customer direct creation).
- **Update:** `allow update: if isValidId(orderId) && isAdmin() && isValidOrderUpdate(incoming()) && incoming().diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt']);`
- **Delete:** `allow delete: if isValidId(orderId) && isAdmin();`

### 9. `/orderNumbers/{orderNumber}`
- **Read:** Admin only.
- **Create:** `allow create: if isValidId(orderNumber) && isAdmin() && isValidOrderNumberClaim(incoming(), orderNumber);`
- **Update / Delete:** `allow update, delete: if false;`

### 10. `/admins/{adminUid}`
- **Get:** `allow get: if isSignedIn() && isValidId(adminUid) && (request.auth.uid == adminUid || isAdmin());`
- **List:** `allow list: if isVerifiedAdminToken();`
- **Create / Update / Delete:** `allow create, update, delete: if false;` (Locked to prevent client self-provisioning).

### 11. `/mediaAssets/{assetId}` & `/chunks/{chunkId}`
- **Read:** Gated to `isPublic == true` or Admin.
- **Create:** Admin only with `isValidMediaAsset` / `isValidMediaChunk`.
- **Update:** `allow update: if false;` (Immutable).
- **Delete:** Admin only.

### 12. `/reports/{reportId}`
- **Create:** `allow create: if isValidId(reportId) && isSignedIn() && isValidReportCreate(incoming());`
- **Read / Delete:** Admin only.
- **Update:** `allow update: if isValidId(reportId) && isAdmin() && isValidReportUpdate(incoming()) && affectedKeys().hasOnly(['status']);`

### 13. `/fcmTokens/{tokenId}`
- **Read / Create / Update / Delete:** `allow get, list, create, update, delete: if isSignedIn() && ('uid' in resource.data ? resource.data.uid == request.auth.uid : incoming().uid == request.auth.uid);`

### 14. `/idempotencyKeys/{keyId}`
- **Read / Write:** `allow read, write: if false;` (Server-only).
