# STAGE 04N.5A — STATIC VALIDATION REPORT

- **Audit Stage:** `04N.5A — Static Rules Validation`
- **Mode:** Strictly Read-Only Analysis (Zero Code Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Static Validation Findings

1. **Syntax & Rule Version:** Rules begin with `rules_version = '2';` and `service cloud.firestore` matching valid Firestore Rules v2 syntax.
2. **Global Default-Deny Catch-All:** `match /{document=**} { allow read, write: if false; }` is correctly positioned at the top of `match /databases/{database}/documents`, ensuring unconfigured collections are denied by default.
3. **Anonymous Exclusion:** `isNonAnonymousUser()` correctly inspects `request.auth.token.firebase.sign_in_provider != 'anonymous'`, completely closing the historical `sign_in_provider is string` vulnerability.
4. **Query Compatibility (`list` rules):** All collection `list` rules rely on `isVerifiedAdminToken()` or resource-level checks (`resource.data.inStock == true`, `resource.data.customerUid == request.auth.uid`), avoiding forbidden `exists()` or `get()` function calls inside unconstrained `list` queries.
5. **Cross-Document Invariants (`getAfter`/`existsAfter`):** Promotion rules on `/orders` and `/orderRequests` correctly verify target document existence (`existsAfter(/orders/$(approvedOrderId))`) and exact payload parity (`getAfter(/orders/$(approvedOrderId)).totalBill == verifiedPricing.totalSar`) without exceeding Firestore's single-transaction document-read limits.
6. **Immutable Fields & Updates:** `.diff(existing()).affectedKeys().hasOnly(...)` guards protect `/orders` and catalog collections against shadow field injection.

---

## 2. Validation Limitations

- **No Live Emulator Execution (`NO_JAVA`):** Because Java is absent from the container, this static validation was conducted via structural parsing and rules invariant comparison against test suites (`scripts/stage04l.test.ts`, `stage04m.test.ts`), without executing dynamic `@firebase/rules-unit-testing` suites.
- **Spark Client Transaction Dependency:** Because Firebase Spark has zero Cloud Functions, atomic stock deduction and authoritative pricing summation rely on client `runTransaction` execution, protected by rules enforcing Admin authorization and schema bounds.
