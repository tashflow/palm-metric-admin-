# STAGE 04N.4A — CUSTOMER APP FIRESTORE SCHEMA & WORKFLOW AUDIT REPORT

- **Audit Stage:** `04N.4A — Customer App Firestore Schema Audit`
- **Mode:** Strictly Read-Only Investigation (Extracted from Verified Customer Identity B Archive `palm-metric-stage04n24-customer.zip`)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Backend Architecture:** Firebase Spark Free (Zero Cloud Functions)
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Executive Summary & Provenance Scope

This report documents the strictly read-only audit of the Palm Metric Customer App workspace extracted from the verified Identity B archive (`palm-metric-stage04n24-customer.zip`, `108` files, SHA-256 `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`). It details the exact Customer Firestore collections, client write patterns (such as `/orderRequests` submission, `/reports`, `/fcmTokens`), security rules (`firestore.spark.rules`), and data contracts needed for a unified cross-app ruleset.

---

## 2. Customer Collection-by-Collection Schema & Operation Audit

1. **`/menu/{itemId}` & `/categories/{categoryId}` & `/billboards/{billboardId}` & `/productCustomizations/{productId}` & `/settings/{settingId}`**: Read-only for customers, filtered via queries (`inStock == true`, `isActive == true`, `enabled == true`) or public single-doc `get`.
2. **`/orderRequests/{requestId}`**: Customer write entry point for pickup orders. Created via `createCustomerOrderRequest()` (`src/lib/firestoreSync.ts` / `adminOrderRequests.ts`), setting `customerUid == request.auth.uid`, `status == 'pending_review'`, `pickupType == 'pickup'`, `currency == 'SAR'`, and `items` (`1..50`). Customers can read/list only their own requests (`customerUid == request.auth.uid`). Zero update or delete permissions.
3. **`/orders/{orderId}`**: Read-only for customers (`customerUid == request.auth.uid`). Direct creation and updates by customers are strictly blocked (`allow create: if false;`).
4. **`/reports/{reportId}`**: Customer app submits feedback and issue reports (`AppReport`) with `status == 'New'` and `createdAt == request.time`. Read/update/delete restricted to admins.
5. **`/fcmTokens/{tokenId}`**: Web push notification registration tokens stored by `src/lib/fcm.ts` at `fcmTokens/${auth.currentUser.uid}_${token.slice(0, 16)}`, strictly scoped to owner UID (`uid == request.auth.uid`).

---

## 3. Exact Files Modified

- **Source, Rules, Configuration, Dependency, Lockfile, and Archive Files Modified:** **`ZERO (0)`**
- **Created Deliverable Report:** `/STAGE_04N4A_CUSTOMER_FIRESTORE_SCHEMA_AUDIT.md`

---

## 4. Final Verdict

### **`PASS WITH LIMITATIONS`**

*(Customer schema and workflow audit successfully completed from verified Identity B archive evidence; production provenance and live Emulator validation remain unverified/blocked.)*
