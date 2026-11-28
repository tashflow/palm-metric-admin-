# STAGE 04N.4C — CROSS-APP SCHEMA CONFLICTS & RESOLUTION REPORT

- **Audit Stage:** `04N.4C — Cross-App Schema Conflicts Reconciliation`
- **Mode:** Strictly Read-Only Investigation (Zero Code or Rules Mutations)
- **Date:** `2026-11-28`

---

## 1. Conflict 1: Order Request Schema Fields (`orderType` vs `pickupType`, `requestReference`)

- **Customer Evidence:** Customer `firestore.spark.rules:334-340` permits optional `pickupType`, `pickupWindow`, `orderNote`, and requires `requestReference` matching `^REQ-[a-zA-Z0-9_\-]+$`.
- **Admin Evidence:** Admin `firestore.spark.rules:224-230` requires `requestReference` (`REQ-...`) and permits `orderType` and `pickupType`.
- **Risk:** Divergent required fields could cause client writes to fail rules validation if one app omits a key required by the other.
- **Resolution:** **Canonical Contract:** Require `requestReference` (`REQ-...`), make `orderType == 'pickup'` and `pickupType == 'pickup'` optional/defaulted, and support both `notes` and `orderNote` (`<=300` chars).

## 2. Conflict 2: Catalog `imageUrl` and String Limits

- **Customer Evidence:** Customer `firestore.spark.rules:163` allows `imageUrl` up to `700,000` chars (permitting inline base64 data URIs).
- **Admin Evidence:** Admin `firestore.spark.rules:94` caps `imageUrl` at `2,048` chars (Storage download URLs).
- **Risk:** Base64 data URIs bloat Firestore documents toward the 1MB document limit and bypass Storage security.
- **Resolution:** **Canonical Contract:** Enforce Admin's strict limit (`imageUrl <= 2048`, rejecting `data:` URIs in rules) to enforce Firebase Storage usage.

## 3. Conflict 3: `/settings/pricing` Exposure & Validation

- **Customer Evidence:** Customer `firestore.spark.rules:665` opens `allow get: if isValidId(settingId);`, leaking private settings documents, and omits `pricing` validation.
- **Admin Evidence:** Admin `firestore.spark.rules:415` restricts `get` to `settingId == 'coffeeOptions' || isAdmin()`, and validates `pricing` (`isValidPricingSettings`).
- **Risk:** Unauthenticated read access to store financial/pricing configuration.
- **Resolution:** **Canonical Contract:** Adopt Admin's strict `get` gating (`settingId == 'coffeeOptions' || isAdmin()`) and include `pricing` schema validation (`taxEnabled`, `discountEnabled`, etc.).

## 4. Conflict 4: `/admins/{adminUid}` Client Mutability

- **Customer Evidence:** Customer `firestore.spark.rules:772` enforces `allow create, update, delete: if false;`.
- **Admin Evidence:** Admin `firestore.spark.rules:529-531` permits `isVerifiedAdminToken()` to modify `/admins/{uid}`.
- **Risk:** Compromised admin token minting persistent backdoor admin records.
- **Resolution:** **Canonical Contract:** Adopt Customer's strict lock (`allow create, update, delete: if false;`), making admin provisioning Console/Server-only.

## 5. Conflict 5: `/orderRequests` Deletion & Cross-Doc Verification

- **Customer Evidence:** Customer `firestore.spark.rules:424` checks `getAfter(/orders/...).totalBill == verifiedTotalSar`, but allows `isAdmin()` `delete` on `/orderRequests` (`line 696`).
- **Admin Evidence:** Admin `firestore.spark.rules:460` sets `allow delete: if false;`, but omits the `totalBill == verifiedPricing.totalSar` cross-doc check.
- **Resolution:** **Canonical Contract:** Merge both strengths: `allow delete: if false;`, require `approvedOrderId == 'ord_' + requestId`, AND require `getAfter(/orders/$(approvedOrderId)).totalBill == verifiedPricing.totalSar`.
