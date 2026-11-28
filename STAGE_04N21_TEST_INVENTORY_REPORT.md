# STAGE 04N.2.1 — Test Inventory & Execution Reconciliation Report

**Date:** 2026-11-25  
**Execution Target:** Extracted Release Archives (`/tmp/stage04n21_verify_extract/customer` and `/tmp/stage04n21_verify_extract/admin`)  
**Total Executed Active Spark Tests:** **148 passed, 0 failed, 0 skipped** (`69` Customer + `79` Admin), plus `1` Customer static rules audit script (`audit-rules.mjs`)  
**Live Firebase Emulator Execution:** **0 executed (`BLOCKED` — `NO_JAVA`)**

---

## 1. Reconciliation of Conflicting Test Counts (`118` vs `148`)

| Metric | Earlier Conflicting Report (`118`) | Verified Stage 04N.2.1 Reality (`148`) | Exact Root Cause of Conflict |
|---|---:|---:|---|
| **Customer Active Spark Tests** | 82 | **69** *(+ 1 static audit script)* | Upstream Customer `9f265ab` has exactly `12 + 17 + 20 + 12 + 8 = 69` active tests across 5 scripts. The earlier `82` count double-counted `scripts/stage04d.test.ts` (`12`) + `scripts/audit-rules.mjs` (`1`) on top of `69` (`69 + 12 + 1 = 82`). Note also that legacy Blaze `functions/src/__tests__/orderEngine.test.ts` contains **20** additional tests that are **not** executed (`functions/node_modules` absent; Spark uses zero Cloud Functions). |
| **Admin Tests** | 36 | **79** | Upstream GitHub Admin `54e5453` had **36** tests (`scripts/stage04l.test.ts` = `18` `node:test` blocks + `scripts/stage04m.test.ts` = `8` + `src/lib/productCustomizations.test.ts` = `10`). Adding Stage 04N `scripts/stage04n.test.ts` (`43` `node:test` blocks) yields **79** (`69` via `npm test` + `10` in `src/lib/productCustomizations.test.ts`). |
| **Combined Total** | 118 (`82 + 36`) | **148 (`69 + 79`)** | Removing Customer double-counting (`-13`) and including Stage 04N Admin suite (`+43`) cleanly reconciles `118 -> 148`. |

---

## 2. Customer App Verification Matrix (`/tmp/stage04n21_verify_extract/customer`)

| Check / Suite | Command Executed | Test Count | Passed | Failed | Skipped | Exit Code | Execution Classification |
|---|---|---:|---:|---:|---:|---:|---|
| TypeScript Check | `npm run lint` (`tsc --noEmit`) | — | Pass | 0 | 0 | `0` | Static Typecheck |
| Vite Production Build | `npm run build` | — | Pass | 0 | 0 | `0` | Bundle Verification (`dist/` emitted in `1.56s`) |
| Static Rules & Blueprint Audit | `node scripts/audit-rules.mjs` | 1 script *(17 assertions)* | 1 | 0 | 0 | `0` | Static Rules / Blueprint Regex Audit |
| Stage 04D/04E Client Regression | `npx tsx --test scripts/stage04d.test.ts` / `npx tsx scripts/stage04d.test.ts` | 12 | 12 | 0 | 0 | `0` | In-Memory Unit & Schema Assertions |
| Stage 04K Order Request Suite | `npx tsx --test scripts/stage04k.test.ts` / `npx tsx scripts/stage04k.test.ts` | 17 | 17 | 0 | 0 | `0` | In-Memory Validation & Regex Rules Audit |
| Stage 04L Admin Approval Suite | `npx tsx --test scripts/stage04l.test.ts` / `npx tsx scripts/stage04l.test.ts` | 20 | 20 | 0 | 0 | `0` | In-Memory `MockFirestore` + Rules Inspection |
| Stage 04L.1 Hardening Suite | `npx tsx --test scripts/stage04l1.test.ts` / `npx tsx scripts/stage04l1.test.ts` | 12 | 12 | 0 | 0 | `0` | In-Memory `MockFirestore` + Rules Inspection |
| Stage 04M Integration Suite | `npx tsx --test scripts/stage04m.test.ts` | 8 | 8 | 0 | 0 | `0` | In-Memory `MockStore` + Rules Inspection *(~61.6s due to Firebase client SDK handle)* |
| **Customer Active Spark Subtotal** | **5 Spark test files** *(+ 1 audit script)* | **69** *(+1)* | **69** *(+1)* | **0** | **0** | **`0`** | **0 Live Emulator Tests** |
| Legacy Blaze Functions Suite *(Inactive)* | `functions/src/__tests__/orderEngine.test.ts` | 20 | 0 | 0 | 20 *(unexecuted)* | — | Legacy Blaze reference (`functions/node_modules` omitted; unused on Spark) |

> Note on runner behavior: Customer `scripts/stage04*.test.ts` use a custom `passed/failed` runner rather than `node:test`'s `test()` blocks, so `tsx --test <file>` prints `1` file-level subtest while executing all `69` internal test cases inside the script (`12 + 17 + 20 + 12 + 8`). Running with `npx tsx <file>` prints all `69` individual `PASS:` lines and summaries directly.

---

## 3. Admin App Verification Matrix (`/tmp/stage04n21_verify_extract/admin`)

| Check / Suite | Command Executed | Test Count | Passed | Failed | Skipped | Exit Code | Execution Classification |
|---|---|---:|---:|---:|---:|---:|---|
| TypeScript Check | `npm run lint` (`tsc --noEmit`) | — | Pass | 0 | 0 | `0` | Static Typecheck |
| Vite Production Build | `npm run build` | — | Pass | 0 | 0 | `0` | Bundle Verification (`dist/` emitted in `1.28s`) |
| Stage 04L Admin Approval Suite | `npx tsx --test scripts/stage04l.test.ts` | 18 `test()` *(covers numbered scenarios 01–22)* | 18 | 0 | 0 | `0` | In-Memory Mock Store + Static Rules Audit |
| Stage 04M Integration Suite | `npx tsx --test scripts/stage04m.test.ts` | 8 | 8 | 0 | 0 | `0` | In-Memory Mock Transaction + Rules Audit |
| Stage 04N Verification Suite | `npx tsx --test scripts/stage04n.test.ts` | 43 | 43 | 0 | 0 | `0` | In-Memory Mock Transaction + Static Contract/Rules Booleans |
| Customizations & Rules Suite | `npx tsx --test src/lib/productCustomizations.test.ts` | 10 | 10 | 0 | 0 | `0` | Unit & Static Rules Inspection |
| **Admin Subtotal** | **`npm test` (69) + `productCustomizations.test.ts` (10)** | **79** | **79** | **0** | **0** | **`0`** | **0 Live Emulator Tests** |

---

## 4. Simulation vs Real Firebase Emulator Honesty Audit

- **All 148 passing tests are simulated/in-memory or static regex checks.** Specifically:
  - Customer `stage04l`, `stage04l1`, `stage04m` and Admin `stage04l`, `stage04m`, `stage04n` run transactional logic against in-memory TypeScript `MockStore` / `MockFirestore` maps and inspect `firestore.spark.rules` / `firestore.rules` text with string/regex checks.
  - Several assertions inside Admin `scripts/stage04n.test.ts` (tests `06`, `07`, `09`, `16–18`, `35–37`, `41–43`) are lightweight static contract/boolean assertions preserved without alteration per Stage 04N.2.1 rules.
  - Neither repository uses `@firebase/rules-unit-testing` nor executes live Firestore Security Rules evaluations.
  - Live `firebase emulators:exec --only auth,firestore` is blocked in this container due to missing Java (`NO_JAVA`).
