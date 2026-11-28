# STAGE 04N.2.6 — Customer Test Evidence Report

**Audit Stage:** Stage 04N.2.6 (Strictly Read-Only, Customer Dependencies Only)  
**Policy Enforced:** Admin `/app/applet/node_modules` was **NOT** used; zero dependencies were installed; zero test counts were inferred or fabricated.

---

## 1. Exact Customer Test Execution Log (`/tmp/stage04n26_extract/stage04n24-customer`)

| Suite / Script | Command Executed | Working Directory | Exit Code | Result | Exact Error / Output |
|---|---|---|---:|---|---|
| Static Security & Schema Audit | `node scripts/audit-rules.mjs` | `/tmp/stage04n26_extract/stage04n24-customer` | `0` | **PASS (1 / 1)** | `PASS: Static security & schema audit passed for firestore.rules and firebase-blueprint.json.` |
| Stage 04D/04E Client Tests (12 defined tests) | `npx --no-install tsx scripts/stage04d.test.ts` | `/tmp/stage04n26_extract/stage04n24-customer` | `1` | **FAILED / BLOCKED (0 executed)** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase' imported from /tmp/stage04n26_extract/stage04n24-customer/src/lib/firestoreSync.ts` |
| Stage 04K Order Request Tests (17 defined tests) | `npx --no-install tsx scripts/stage04k.test.ts` | `/tmp/stage04n26_extract/stage04n24-customer` | `1` | **FAILED / BLOCKED (0 executed)** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'react' imported from /tmp/stage04n26_extract/stage04n24-customer/src/components/CheckoutPage.tsx` |
| Stage 04L Workflow & Pricing Tests (20 defined tests) | `npx --no-install tsx scripts/stage04l.test.ts` | `/tmp/stage04n26_extract/stage04n24-customer` | `1` | **FAILED / BLOCKED (0 executed)** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase' imported from /tmp/stage04n26_extract/stage04n24-customer/src/lib/adminOrderRequests.ts` |
| Stage 04L.1 Hardening Tests (12 defined tests) | `npx --no-install tsx scripts/stage04l1.test.ts` | `/tmp/stage04n26_extract/stage04n24-customer` | `1` | **FAILED / BLOCKED (0 executed)** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase' imported from /tmp/stage04n26_extract/stage04n24-customer/src/lib/adminOrderRequests.ts` |
| Stage 04M Integration Tests (9 defined tests) | `npx --no-install tsx scripts/stage04m.test.ts` | `/tmp/stage04n26_extract/stage04n24-customer` | `1` | **FAILED / BLOCKED (0 executed)** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase' imported from /tmp/stage04n26_extract/stage04n24-customer/src/lib/adminOrderRequests.ts` |
| Legacy Blaze Functions Tests (`functions/src/__tests__/orderEngine.test.ts`, 20 tests) | *(Not executed — inactive Spark legacy)* | — | — | **INACTIVE / SKIPPED** | Legacy Blaze reference unused on Spark runtime |
| Live Firebase Emulator (`auth`, `firestore`) | `which java` / `firebase` (`15.36.0`) | `/app/applet` | `1` | **`BLOCKED — NO_JAVA`** | `NO_JAVA_BIN` (`java` not installed in container) |

---

## 2. Summary Counts (Observed Directly Under Customer-Only Dependencies)

- **Pure-Node Static Audit (`audit-rules.mjs`):** **1 / 1 PASS** (also passed across extracted `04n22`, `04n21`, and `04n2` Customer archives).
- **Customer TypeScript Automated Test Suites (`70` defined active tests across 5 files):** **0 / 70 executed under Customer-only dependencies** (`BLOCKED` by absent Customer `node_modules`: missing `'firebase'` and `'react'`).
- **Live Firebase Emulator Tests:** **0 executed (`BLOCKED — NO_JAVA`)**.
