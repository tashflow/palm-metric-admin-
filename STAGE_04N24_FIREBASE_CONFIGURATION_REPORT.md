# STAGE 04N.2.4 — Firebase Configuration Report

## 1. Investigation of `universal-nomad-kwpgt`
During Stage 04N.2.3/04N.2.4 audit, Customer App's root `firebase-applet-config.json` still contained leftover AI Studio remix metadata:
- Old `projectId`: `universal-nomad-kwpgt`
- Old `firestoreDatabaseId`: `ai-studio-d605dbc1-6b60-4f95-aa23-547f79d7d4d8`

Inspection of all Customer source files confirmed `firebase-applet-config.json` was never imported at runtime; Customer's actual Firebase runtime (`src/lib/firebase.ts` and `public/firebase-messaging-sw.js`) already initialized against `palm-metric-app` with `(default)` Firestore credentials identical to Admin App.

## 2. Canonical Firebase Target Alignment
Both applications are now aligned across runtime code and `firebase-applet-config.json`:

| Field | Customer App | Admin App | Status |
| :--- | :--- | :--- | :--- |
| `projectId` | `palm-metric-app` | `palm-metric-app` | ALIGNED |
| `firestoreDatabaseId` | `(default)` | `(default)` | ALIGNED |
| `authDomain` | `palm-metric-app.firebaseapp.com` | `palm-metric-app.firebaseapp.com` | ALIGNED |
| `storageBucket` | `palm-metric-app.firebasestorage.app` | `palm-metric-app.firebasestorage.app` | ALIGNED |
| `messagingSenderId` | `522581928710` | `522581928710` | ALIGNED |
| `appId` | `1:522581928710:web:993ecee99d938707fc8c87` | `1:522581928710:web:993ecee99d938707fc8c87` | ALIGNED |
| `apiKey` | `AIzaSyBmmyvlE3GKl8PVc1LHNBZOsl_MkqCWPlo` | `AIzaSyBmmyvlE3GKl8PVc1LHNBZOsl_MkqCWPlo` | ALIGNED |
| Currency / Mode | `SAR` / `pickup` only | `SAR` / `pickup` only | ALIGNED |
| Hosting / Functions | Spark Plan (zero Cloud Functions) | Spark Plan (zero Cloud Functions) | ALIGNED |

## 3. Rules & Blueprint Isolation Policy
- **Production `firestore.rules`:** Left completely untouched in both Customer and Admin workspaces per Stage 04N.2.4 instructions (no production deployment or live rule writes performed).
- **Spark Rules (`firestore.spark.rules` & `firebase-blueprint.json`):** Converged across both Customer and Admin to enforce:
  - Both Admin UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and all 4 Admin emails (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`)
  - Canonical `reviewing` status transitions + legacy `under_review` / `in_review` readability
  - Mandatory `requestReference` (`REQ-...`), `verifiedPricing.totalSar` == `totalBillSar`, `sourceRequestId`, and nested `/orderRequests/{requestId}/auditLogs/{logId}`
  - Atomic order promotion linking `/orderRequests`, `/orders` (`ord_<requestId>`), `/orderNumbers` (`PM-...`), and `/menu` stock deduction.
