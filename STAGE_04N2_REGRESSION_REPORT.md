# STAGE 04N.2 — REGRESSION VERIFICATION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Currency:** `SAR`  
**Date:** November 26, 2026  

---

## 1. Test Suite Summary

All automated test suites, security rule compliance audits, authorization checks, order lifecycle workflows, inventory atomicity tests, and concurrency tests have been executed with zero failures.

- **Total Admin Tests Executed:** 71
- **Total Admin Tests Passed:** 71
- **Total Admin Tests Failed:** 0
- **TypeScript Compilation (`tsc --noEmit`):** Clean (0 errors).
- **Production Build (`vite build`):** Successful.

---

## 2. Component Test Breakdown

1. **Admin Authorization & Allowlist Tests (Tests 1–19):**
   - Verified that all 4 canonical admin emails (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`) and 2 UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) match correctly.
   - Verified that unverified email accounts fail closed with denial reason `'unverified'` even when matching allowlisted email strings.
   - Verified that anonymous and non-admin actors are strictly denied.

2. **Order Lifecycle & Authoritative Pricing (Tests 20–37):**
   - Verified halala-exact SAR arithmetic across base prices, sizes, and add-ons.
   - Verified that untrusted client price estimates cannot affect official order totals.
   - Verified status transitions from `pending_review` -> `under_review` -> `verified` -> `order_created` / `rejected`.

3. **Inventory Atomicity & Stock Depletion (Tests 38–53 & Hardening Suite):**
   - Verified atomic stock quantity and stock count deductions on approval.
   - Verified that stock depletion automatically sets `inStock: false` and related availability flags.
   - Verified that unmanaged inventory items bypass stock checks without error.

4. **Concurrency, Idempotency & Order Number Collision (Tests 54–71):**
   - Verified that concurrent Admin approvals create strictly one `/orders` document with zero duplication.
   - Verified that idempotent retries return existing promoted orders without re-deducting stock.
   - Verified collision-checked unique `PM-XXXXXX` order number allocation via `/orderNumbers/{orderNumber}` claim registry.
