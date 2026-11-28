# STAGE 04N.7A — FIRESTORE RULES TEST READINESS

- **Audit Stage:** `04N.7A — Rules Test Readiness`
- **Target File:** `/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Existing Test Assessment

Existing test scripts (e.g., `audit-rules.mjs` or mock unit tests) perform static or mock-level checks rather than executing live gRPC assertions against the actual Firebase Firestore Emulator because Java is unavailable.

---

## 2. Required Test Scenarios for Future Execution

When a Java 17+ environment with the Firestore Emulator is available, the test suite must validate:

1. **Unauthenticated Access:** Direct read/write to restricted collections must be denied.
2. **Anonymous Customer Access:** Anonymous sign-ins are blocked from admin actions and sensitive paths (`isNonAnonymousUser()`).
3. **Customer Ownership Isolation:** Customers can only read/write their own `/orderRequests`, `/orders`, `/fcmTokens`, and `/reports`.
4. **Unauthorized Admin Denial:** Non-whitelisted users attempting admin actions are rejected.
5. **Verified Admin Authorization:** Whitelisted UIDs and emails successfully pass `isAdmin()`.
6. **Customer Direct Final-Order Creation Denial:** Customers cannot directly write to `/orders`.
7. **Customer Order Modification Denial:** Customers cannot modify official orders.
8. **Admin Order Promotion:** Valid admin promotion from `/orderRequests` to `/orders` succeeds.
9. **Duplicate Order-Number Rejection:** Reusing an existing order number claim on `/orderNumbers` is blocked.
10. **Insufficient Inventory Rejection:** Orders exceeding stock availability are rejected.
11. **Atomic Consistency:** Cross-document `existsAfter()` / `getAfter()` invariants correctly verify request/order/number consistency.
12. **Reports & FCM Ownership:** Proper validation of report creation and FCM token user association.
13. **Media Asset Visibility:** Public assets readable by all; private assets restricted to admin/creator.
14. **Admin Self-Provisioning Denial:** Writes to `/admins/{adminUid}` are unconditionally blocked (`allow create, update, delete: if false;`).
