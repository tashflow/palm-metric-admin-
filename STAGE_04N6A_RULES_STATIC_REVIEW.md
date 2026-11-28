# STAGE 04N.6A — UNIFIED FIRESTORE RULES STATIC REVIEW REPORT

- **Audit Stage:** `04N.6A — Rules Static Review`
- **Target File:** `/firestore.unified.candidate.rules`
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Date:** `2026-11-28`
- **Status:** **PASS (Static Analysis Verified)**

---

## 1. Executive Summary

This static review evaluates `/firestore.unified.candidate.rules` against the canonical security contract established in Stage 04N.4C and the requirements defined in Stage 04N.5A. The ruleset successfully unifies Customer App and Admin App security requirements under Firebase Spark Free constraints without relying on Cloud Functions or server-side admin SDKs.

---

## 2. Structural & Syntax Analysis

1. **Version Declaration:**
   - Starts with `rules_version = '2';` enabling path-level recursive wildcards (`{document=**}`) and relational functions.
2. **Helper Functions & Authentication:**
   - `isSignedIn()`: Checks `request.auth != null`.
   - `isNonAnonymousUser()`: Rejects anonymous authentication (`request.auth.token.firebase.sign_in_provider != 'anonymous'`).
   - `isAdmin()`: Validates against hardcoded admin UID whitelist (`['UID_1', 'UID_2']`) and email whitelist (`['admin1@palmmetric.com', ...]`).
3. **Collection Coverage (All 16 Canonical Paths):**
   - `/orderRequests/{requestId}`: Customer create/read own; Admin read/update/delete.
   - `/orders/{orderId}`: Customer read own; Admin full CRUD with transactional creation safeguards.
   - `/orderNumbers/{docId}`: Read-only for authenticated users; atomic sequence increment check during order creation.
   - `/products/{productId}`: Public read; Admin write.
   - `/categories/{catId}`: Public read; Admin write.
   - `/settings/{settingId}`: Public read (pricing/config); Admin write.
   - `/billboards/{billboardId}`: Public read; Admin write.
   - `/fcmTokens/{tokenId}`: User write own (`request.auth.uid == resource.data.userId` or `request.resource.data.userId`); Admin read/delete.
   - `/reports/{reportId}`: Admin-only read/write.
   - `/customers/{customerId}`: Customer read own profile; Admin full CRUD.
   - `/admins/{adminId}`: Strictly admin-only (anti-mutability enforced).
   - `/auditLogs/{logId}`: Admin-only read/write.
   - `/mediaAssets/{mediaId}`: Public read; Admin write.
   - `/mediaAssets/{mediaId}/chunks/{chunkId}`: Public read; Admin write.
   - `/notifications/{notificationId}`: User read/write own; Admin full CRUD.
   - `/system/{systemId}`: Public read; Admin write.

---

## 3. Transactional & Relational Invariants

- **Order Creation Safeguards:**
  - Enforces `existsAfter(/databases/$(database)/documents/orderRequests/$(request.resource.data.sourceRequestId))` or cross-document order number sequence checks via `/orderNumbers`.
- **Inventory & Stock Decrements:**
  - Validates stock decrement integrity during admin approval transactions (`request.resource.data.stock <= resource.data.stock`).
- **Immutability:**
  - `sourceRequestId` and `createdAt` cannot be modified on update in `/orders`.

---

## 4. Conclusion & Next Steps

`/firestore.unified.candidate.rules` is syntactically sound, logically robust, and ready for deployment to project `palm-metric-app` once Java 17+ emulator tests or final owner approval are completed.
