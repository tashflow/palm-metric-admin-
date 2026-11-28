# STAGE 04N.2.3 — CROSS-APP FINAL VERIFICATION REPORT

**Project:** Palm Metric (`palm-metric-app`) | **Database:** `(default)` | **Currency:** `SAR` | **Fulfillment:** `pickup` only  
**Customer Archive Under Audit:** `palm-metric-stage04n22-customer.zip` (`14254ac4...`, 107 files)  
**Admin Archive Under Audit:** `palm-metric-stage04n22-admin.zip` (`032688b3...`, 98 files)  
**Audit Date:** 2026-11-26  
**Overall Cross-App Compatibility Verdict:** **`FAIL`**

---

## 1. End-to-End Cross-App Contract Matrix

| # | Contract Area | Customer Archive (`04n22-customer.zip`) | Admin Archive (`04n22-admin.zip`) | Compatibility Verdict |
|---|---|---|---|---|
| **1** | **Firebase Project & Config** | `firebase.ts`: `palm-metric-app`; **`firebase-applet-config.json`: `universal-nomad-kwpgt` / `ai-studio-d605dbc1-...`** | `firebase.ts` & `firebase-applet-config.json`: `palm-metric-app` / `(default)` | **FAIL (Config Drift)** |
| **2** | **Order Request Creation Payload** | `buildCustomerOrderRequestPayload` (`firestoreSync.ts:905-918`) **omits `requestReference`** | `firestore.spark.rules:224,232` **requires `requestReference`** (`hasAll(['requestReference', ...])` matching `^REQ-...`) | **FAIL (Breaking)** — Customer create is denied under Admin Spark rules |
| **3** | **Order Review Status (`'under_review'` vs `'reviewing'`)** | `types.ts:153`, `firestoreSync.ts:950`, `adminOrderRequests.ts`, `firestore.spark.rules:380` use **`'reviewing'`** and **reject `'under_review'`** | `orderRequests.ts:461` writes **`'under_review'`**; `firestore.spark.rules:253` allows `'under_review'` (reads legacy `'reviewing'`) | **FAIL (Breaking)** — Admin review fails under Customer Spark rules; Customer tracker mis-maps `'under_review'` to `'pending_review'` |
| **4** | **Order Request Admin Update Fields** | Customer `firestore.spark.rules:359-368` `hasOnly(...)` **omits `reviewStatus`, `reviewedByEmail`, `verifiedByEmail`, `verifiedItems`, `approvedByEmail`, `rejectedByEmail`, `auditTrail`** | Admin `orderRequests.ts` writes `reviewStatus`, `reviewedByEmail`, `verifiedItems`, `auditTrail`, etc.; Admin `firestore.spark.rules` allows them | **FAIL (Breaking)** — Admin transitions fail under Customer Spark rules |
| **5** | **Order Identifiers (`sourceRequestId` & `ord_<id>`)** | Writes `sourceRequestId`, `ord_<requestId>`, and `PM-XXXXXX` in `adminOrderRequests.ts` | Writes `sourceRequestId: req.id`, `ord_<requestId>`, and `PM-XXXXXX` in `orderRequests.ts:768` | **PASS** |
| **6** | **Atomic Inventory Deduction & Exact-Once Stock** | `adminOrderRequests.ts` runs `computeStockDeductionPlans` in `runTransaction`; rejects do not touch stock | `orderRequests.ts:828-855` runs `computeStockDeductionPlans` + `tx.updateMenuDoc` in `runTransaction`, flips `inStock: false` at `0`; rejects do not touch stock | **PASS (In-Memory / Code)** — Not verified against live Emulator (`NO_JAVA`) |
| **7** | **Concurrency & `/orderNumbers` Registry** | Uses `/orderNumbers/{orderNumber}` claim + deterministic `ord_<requestId>` | Uses `/orderNumbers/{orderNumber}` claim + deterministic `ord_<requestId>` + `idempotentReplay` guard | **PASS (In-Memory / Code)** — Live Firestore transaction contention blocked (`NO_JAVA`) |
| **8** | **Admin Allowlist Parity** | **4 emails** (`palmmetric1`, `palmmatric1`, `tashfilartwork`, `tashflow26`), **1 UID** (`39H76y...` only; **missing `jPgFPc8...`**) | **4 emails** (same 4) + **2 UIDs** (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) in TS & `firestore.spark.rules` (legacy `firestore.rules` still 1 UID / 2 emails) | **FAIL (Allowlist Drift)** |
| **9** | **Authoritative Pricing & `verifiedPricing`** | `authoritativePricing.ts` uses integer halalas; emits `totalBillSar` (**no `totalSar`**) | `authoritativePricing.ts` uses integer halalas; emits **both** `totalSar` and `totalBillSar`; Admin `firestore.spark.rules:280,303` **requires `totalSar`** | **PARTIAL FAIL** — Admin output satisfies Customer rules on price key, but Customer pricing helper & rules diverge on `totalSar` vs `totalBillSar` |
| **10** | **Audit Logging Path** | `adminOrderRequests.ts` & Customer `firestore.spark.rules:740` use root `/orderRequestAuditLogs/{auditId}` (**no `/orderRequests/{id}/auditLogs` rule**) | `orderRequests.ts:1128` writes `/orderRequests/{requestId}/auditLogs/{logId}`; Admin `firestore.spark.rules:463,492` allows `/auditLogs` and `/orderRequestAuditLogs` | **FAIL (Breaking under Customer Spark rules)** |

---

## 2. Root Cause of Cross-App Failure

All Stage 04N.2.3 cross-app contract failures trace to one factual root cause verified in `STAGE_04N23_CUSTOMER_ARCHIVE_VERIFICATION.md`:

- **Admin (`palm-metric-stage04n22-admin.zip`)** received the Stage 04N.2.2 convergence updates (`'under_review'`, `sourceRequestId`, atomic stock deduction, `/orderNumbers` claims, 4-email + 2-UID allowlist, `totalSar` + `totalBillSar`, `/orderRequests/{id}/auditLogs`).
- **Customer (`palm-metric-stage04n22-customer.zip`)** did **not** receive the Stage 04N.2.2 convergence updates because it was repacked identically from Stage 04N.2.1 (`0` modified files vs `palm-metric-stage04n21-customer.zip`, only omitting `functions/package-lock.json`).

Consequently, deploying **either** `firestore.spark.rules` file with the two Stage 04N.2.2 archives would fail live end-to-end checkout -> review -> approval -> order tracking transactions.
