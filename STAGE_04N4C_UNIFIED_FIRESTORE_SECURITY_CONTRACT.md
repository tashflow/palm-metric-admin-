# STAGE 04N.4C — UNIFIED FIRESTORE SECURITY CONTRACT RECONCILIATION

- **Audit Stage:** `04N.4C — Unified Firestore Security Contract Reconciliation`
- **Mode:** Strictly Read-Only Cross-App Security Contract Reconciliation (Zero Code, Rules, Config, or Archive Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Backend Architecture:** Firebase Spark Free (Zero Cloud Functions, client-side SDK transactions)
- **Confirmed Workspace Identity:** `/app/applet` is Palm Metric Admin App (`Verda Admin`); Customer evidence sourced from verified Identity B archive (`palm-metric-stage04n24-customer.zip`, SHA-256 `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`).
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Executive Summary & Provenance Reconciliation

This document establishes the canonical cross-app Firestore security contract reconciling the Palm Metric Customer App (Identity B archive) and the Palm Metric Admin App workspace (`/app/applet`). Both applications share the `palm-metric-app` `(default)` Firestore database on the Firebase Spark Free tier. Because Spark execution has no Cloud Functions, server-authoritative calculations and atomic inventory deductions depend on client `runTransaction` paired with fortress-grade Firestore Security Rules.

### Provenance Status Summary:
- **Admin Workspace:** `/app/applet` (`Verda Admin`), Identity B Admin archive (`112` files, SHA-256 `be072ce3...`) verified byte-for-byte. Identity A unresolved.
- **Customer Archive:** `/app/applet/palm-metric-stage04n24-customer.zip` (Identity B, `108` files, SHA-256 `d01917c4...`). Identity A (`f98e5646...`) unresolved.
- **Production Deployment Provenance:** `UNVERIFIED` (`firebase.json`, `.firebaserc`, `.git` absent; live console deployment history unproven).
- **Emulator Verification:** `BLOCKED — NO_JAVA`.

---

## 2. Canonical Authorization & Identity Architecture

1. **Anti-Escalation Rule:** Admin authorization must **never** trust `sign_in_provider is string` alone. All admin helpers explicitly enforce `isNonAnonymousUser()` and require `email_verified == true`.
2. **Canonical Allowlist Parity:**
   - **Admin UIDs (2):** `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`
   - **Admin Emails (4):** `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`
3. **`/admins/{adminUid}` Provisioning Policy:** Client-side writes to `/admins` are locked down (`allow create, update, delete: if false;`), matching `AdminAccessModal.tsx:64` and preventing privilege escalation.

---

## 3. Core Reconciliation Summary Across Modules

- **`orderRequests` & `orders`:** Canonical status normalizes legacy `under_review` and `in_review` to `reviewing`. `sourceRequestId` and `customerUid` are strictly immutable. Atomic 1:1 promotion requires `approvedOrderId == 'ord_' + requestId`, unique `PM-XXXXXX` order number claim in `/orderNumbers`, and `getAfter(/orders/...).totalBill == verifiedPricing.totalSar`.
- **`settings/pricing` & `coffeeOptions`:** Unified under `/settings/{settingId}` with restricted get/list and validated create/update.
- **`menu` & `productCustomizations`:** Stock-tracked items support `stockQuantity`/`stockCount` (`0..100000`) and depletion flags (`inStock: false`, `outOfStock: true`).
- **Secondary Collections (`reports`, `fcmTokens`, `mediaAssets`, `auditLogs`):** Fully integrated into the unified permission matrix and blueprint schema.

---

## 4. Exact Files Modified

- **Source, Rules, Configuration, Dependency, Lockfile, and Archive Files Modified:** **`ZERO (0)`**
- **Created Deliverables:**
  1. `/STAGE_04N4C_UNIFIED_FIRESTORE_SECURITY_CONTRACT.md`
  2. `/STAGE_04N4C_CROSS_APP_SCHEMA_CONFLICTS.md`
  3. `/STAGE_04N4C_UNIFIED_PERMISSION_MATRIX.md`
  4. `/STAGE_04N4C_ORDER_INVENTORY_SECURITY_INVARIANTS.md`

---

## 5. Final Verdict

### **`PASS WITH LIMITATIONS`**

*(Canonical cross-app security contract, conflict resolutions, permission matrix, and inventory invariants successfully reconciled read-only; production deployment provenance and Java Emulator validation remain unverified/blocked.)*
