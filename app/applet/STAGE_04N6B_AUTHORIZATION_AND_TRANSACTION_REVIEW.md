# STAGE 04N.6B — AUTHORIZATION AND TRANSACTION REVIEW

- **Audit Stage:** `04N.6B — Authorization and Transaction Review`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Admin Authentication & Allowlist Verification

- **Confirmed Admin UIDs:**
  - `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`
  - `39H76y4E55g5yX2uY0lE5bQ3a393`
- **Confirmed Email Allowlist:**
  - `tashflow26@gmail.com`
  - `palmmetric1@gmail.com`
  - `palmmatric1@gmail.com`
  - `tashfilartwork@gmail.com`
- **Comparison with `src/lib/adminAllowlist.ts`:**
  - The UIDs and emails in `isVerifiedAdminToken()` match the source implementation exactly.
- **Anonymous User Rejection:**
  - `isNonAnonymousUser()` explicitly disqualifies anonymous sign-in providers (`request.auth.token.firebase.sign_in_provider != 'anonymous'`).
- **Self-Provisioning Prevention:**
  - Ordinary users cannot self-provision admin privileges because writes to `/admins/{adminUid}` are unconditionally rejected (`allow create, update, delete: if false;`).

---

## 2. Order and Inventory Transactional Invariants

- **Deterministic ID:** `/orders/ord_$(requestId)` (`orderId == 'ord_' + data.sourceRequestId`).
- **Order Number Claim:** Validated via `/orderNumbers/{orderNumber}` using `existsAfter()` and `getAfter()`.
- **Source Linkage:** `exists(/databases/$(database)/documents/orderRequests/$(data.sourceRequestId))` and `getAfter()` verification ensuring customer UID and status consistency.
- **Stock Decrements & Transaction Logic:** Handled authoritatively within the Spark Free client-side `runTransaction` execution verified against rules guards (`isValidOrderRequestAdminUpdate`, `isValidPromotedOrderCreate`).
