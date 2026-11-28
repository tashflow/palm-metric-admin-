# STAGE 04N.2.4 — Cross-App Integration Report

## 1. Contract Convergence Matrix (Customer App <-> Admin App)

| Contract Area | Customer App | Admin App | Status |
| :--- | :--- | :--- | :--- |
| Canonical Request Status | `reviewing` (`under_review` / `in_review` normalized -> `reviewing`) | `reviewing` (`under_review` / `in_review` normalized -> `reviewing`) | CONVERGED |
| Request Reference | Emits `requestReference` (`REQ-...`) on creation; preserves in tracker & `/orders` | Reads & emits `requestReference`; preserves on promoted `/orders` | CONVERGED |
| Order Provenance | Writes & reads `sourceRequestId`, `requestId`, `requestReference`, `requestSource` | Reads & preserves `sourceRequestId`, `requestId`, `requestReference`, `sourceApp` | CONVERGED |
| Authoritative SAR Pricing | Integer halalas; emits both `verifiedPricing.totalSar` and `totalBillSar` | Integer halalas; emits both `verifiedPricing.totalSar` and `totalBillSar` | CONVERGED |
| Nested Audit Logs | Writes & subscribes `/orderRequests/{requestId}/auditLogs/{logId}` | Writes & subscribes `/orderRequests/{requestId}/auditLogs/{logId}` | CONVERGED |
| Admin Allowlist UIDs | `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393` | `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393` | CONVERGED |
| Admin Allowlist Emails | `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com` | `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com` | CONVERGED |
| Firebase Target | `palm-metric-app` / `(default)` (`firebase.ts` & `firebase-applet-config.json`) | `palm-metric-app` / `(default)` (`firebase.ts` & `firebase-applet-config.json`) | CONVERGED |

## 2. Live Cross-Module Round-Trip Verification
An automated Node/tsx cross-app integration check executed Customer App's actual `buildCustomerOrderRequestPayload`, `calculateAuthoritativeOrderRequestPricing`, `mapOrderRequestSnapshot`, `mapOrderSnapshot`, and `mapAuditEntrySnapshot` directly against Admin App's `normalizeOrderRequest`, `startOrderRequestReview`, `verifyOrderRequest`, and `approveAndPromoteOrderRequest` (`CROSS_APP_ROUNDTRIP_PASS`):
- **Scenario A (Customized Latte x 2 with Size + Milk groups):**
  - Customer payload generated `requestReference` (`REQ-N24001`) and `pending_review`.
  - Admin `startOrderRequestReview` transitioned status to canonical `'reviewing'`; Customer tracker read back `'reviewing'`.
  - Admin `verifyOrderRequest` computed `42` SAR matching Customer's independent `calculateAuthoritativeOrderRequestPricing` (`42` SAR, `totalSar === totalBillSar === 42`).
  - Admin `approveAndPromoteOrderRequest` created deterministic `/orders/ord_req_cross_04n24_001` (`PM-275115`, `sourceRequestId`, `requestReference: REQ-N24001`), deducted menu stock `8 -> 6`, and recorded 5 audit logs readable via Customer's `mapAuditEntrySnapshot`.
- **Scenario B (Legacy Milk Fallback without `productCustomizations`):**
  - Both Customer and Admin calculated identical `36` SAR (`36 === 36`).
