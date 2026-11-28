# STAGE 04N.2.4 — Final Acceptance Report

## 1. Final Determination
**Status:** **`PASS WITH LIMITATIONS`**

Customer App (`palm-metric-stage04n24-customer.zip`) has been fully restored from the clean baseline with all Stage 04N.2.4 cross-app contracts, verified independently first, and Admin App (`palm-metric-stage04n24-admin.zip`) has been aligned and verified second against the restored Customer implementation. Both release archives were independently extracted, byte-for-byte SHA-256 verified against their source trees, installed from scratch, compiled, built, and tested cleanly.

The sole limitation preventing an unconditional `PASS` is the **absence of a Java runtime (`NO_JAVA`)** in the container, which blocks booting the live Firebase Firestore Emulator (`firebase-tools@15.36.0` is present, JVM is absent).

## 2. Authoritative Stage 04N.2.4 Release Pair
| App | Archive | Files | Size (Bytes) | SHA-256 | Extracted Source Match |
| :--- | :--- | :---: | :---: | :--- | :---: |
| Customer App | `palm-metric-stage04n24-customer.zip` | 108 | 28,099,225 | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` | 108 / 108 identical |
| Admin App | `palm-metric-stage04n24-admin.zip` | 112 | 1,927,570 | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | 112 / 112 identical |

*(Complete per-file SHA-256 entries recorded in `STAGE_04N24_SHA256_MANIFEST.json`.)*

## 3. Contract & Verification Checklist
- [x] Customer workspace remediated first in `/tmp/stage04n24_customer`, strictly separate from Admin `/app/applet`.
- [x] `firebase-applet-config.json` in both apps points to `palm-metric-app` / `(default)`.
- [x] Canonical order status converged on **`reviewing`** across Customer, Admin, `firestore.spark.rules`, and `firebase-blueprint.json`; legacy `'under_review'` and `'in_review'` normalize cleanly to `'reviewing'`.
- [x] `requestReference` (`REQ-...`), `sourceRequestId`, `verifiedPricing.totalSar`, `verifiedPricing.totalBillSar`, dual Admin UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`), 4 Admin emails, and nested `/orderRequests/{requestId}/auditLogs/{logId}` converged across both apps.
- [x] Extracted Customer verification: `tsc --noEmit` PASS, `vite build` PASS, `audit-rules.mjs` PASS, 70 / 70 automated tests PASS.
- [x] Extracted Admin verification: `tsc --noEmit` PASS, `vite build` PASS, `compile_applet` PASS, `lint_applet` PASS, 82 / 82 automated tests PASS.
- [x] Cross-App TypeScript round-trip (`CROSS_APP_ROUNDTRIP_PASS`): PASS.
- [ ] Live Firebase Emulator rules & transaction execution: **BLOCKED (`NO_JAVA`)** — requires OpenJDK runtime in verification host.
- [x] Production Firebase rules (`firestore.rules`), live database, Hosting, Cloud Functions, and GitHub remotes: untouched / not deployed.
