# STAGE 04N.5B — CUSTOMER & ADMIN IDENTITY EVIDENCE REPORT

- **Audit Stage:** `04N.5B — Customer & Admin Identity Evidence`
- **Mode:** Strictly Read-Only Evidence Audit (Zero Code Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Date:** `2026-11-28`

---

## 1. Customer Identity Evidence

- **Verified Identity (Identity B):** `/app/applet/palm-metric-stage04n24-customer.zip`
  - **File Count:** `108` files
  - **Byte Size:** `28,099,225` bytes
  - **SHA-256 Checksum:** `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8`
  - **Firebase Project & DB:** `firebase-applet-config.json` -> Project `palm-metric-app`, Database `(default)`.
  - **Order Request Payload Fields:** `requestId`, `requestReference` (`REQ-...`), `customerUid`, `customerName`, `customerContact`, `items`, `status == 'pending_review'`, `pickupType == 'pickup'`, `currency == 'SAR'`, `createdAt`, `updatedAt`.
  - **Identity A (`f98e5646...`, `143` files, `28,158,125` bytes):** Unresolved / absent from disk.

---

## 2. Admin Identity Evidence

- **Workspace Identification:** `/app/applet` is Palm Metric Admin App (`Verda Admin — Specialty Coffee & Food Management`, `metadata.json`, `index.html`, `src/App.tsx`).
- **Verified Identity (Identity B Archive):** `/app/applet/palm-metric-stage04n24-admin.zip` (`112` files, `1,927,570` bytes, SHA-256 `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`). Verified byte-for-byte identical to `/app/applet` workspace source.
- **Admin Allowlist (`src/lib/adminAllowlist.ts:1-11` & `firestore.spark.rules:51-67`):**
  - **UIDs (2):** `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`
  - **Emails (4):** `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`
- **Anonymous Rejection & Verification:** `isNonAnonymousUser()` (`firestore.spark.rules:44-49`) explicitly rejects `'anonymous'` sign-in provider. `email_verified == true` required for all email-based admin tokens.
- **`/admins` Provisioning Policy:** Client writes locked (`allow create, update, delete: if false;`), matching `AdminAccessModal.tsx:64`.
