# STAGE 04N.2.3 — TEST COUNT RECONCILIATION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Audit Date:** 2026-11-26  
**Audit Mode:** Strictly Read-Only Evidence Freeze  
**Scope:** Reconciling reported figures (`71`, `118`, `82`, `36`, `79`, `81`, `148`, `150`) across Customer (`palm-metric-stage04n22-customer.zip`) and Admin (`palm-metric-stage04n22-admin.zip` / `/app/applet`)

---

## 1. Executive Reconciliation Summary

| Reported Metric | Exact Source & Scope | Actually Executed in Stage 04N.2.3? | Honest Classification |
|---|---|---|---|
| **71** (Admin `STAGE_04N22_TEST_INVENTORY_REPORT.md`) | `npm test` (`tsx --test scripts/*.test.ts` on Admin): `scripts/stage04l.test.ts` (**19**) + `scripts/stage04m.test.ts` (**9**) + `scripts/stage04n.test.ts` (**43**) = **71** | **Yes** (`71/71` passed in `/app/applet`; extracted Admin archive matches `100%` byte-for-byte but lacks `node_modules`) | **47** real mock-transaction / unit / static-rules checks + **24** constant/stub assertions inside `stage04n.test.ts`; **0** live Emulator executions |
| **81** (Full Admin Suite) | Admin `npm test` (**71**) + `src/lib/productCustomizations.test.ts` (**10**) = **81** *(omitted from `npm test` glob `scripts/*.test.ts` and omitted from `STAGE_04N22_TEST_INVENTORY_REPORT.md`)* | **Yes** (`71/71` + `10/10` = **81/81** passed in `/app/applet`) | **57** real checks (mock-tx, pure unit, static rules) + **24** constant/stub assertions; **0** live Emulator executions |
| **118 (`82 + 36`)** (Earlier Historical Count) | **Customer (`82`)** = `69` active Spark tests (`12 + 17 + 20 + 12 + 8`) **double-counted** `+ 12` (`stage04d.test.ts`) `+ 1` (`scripts/audit-rules.mjs`) = `82`; **Admin (`36`)** = upstream `54e5453` baseline (`stage04l.test.ts` `18` + `stage04m.test.ts` `8` + `productCustomizations.test.ts` `10` = `36`) | Historical reconciliation | Contains **13** double-counted Customer checks (`stage04d.test.ts` + `audit-rules.mjs`) and predates Admin `stage04n.test.ts` (`+43`) and Stage 04N.2.2 additions (`+2`) |
| **69 (+1)** (Customer Archive Active Spark Suite) | `scripts/stage04d.test.ts` (**12**) + `stage04k.test.ts` (**17**) + `stage04l.test.ts` (**20**) + `stage04l1.test.ts` (**12**) + `stage04m.test.ts` (**8**) = **69**, plus `scripts/audit-rules.mjs` (**1** pure Node script) + inactive Blaze `functions/src/__tests__/orderEngine.test.ts` (**20**, unexecuted) | **`audit-rules.mjs`: Yes (`EXIT 0`)**. **69 TypeScript tests: BLOCKED (`0` executed)** in extracted Customer archive without unapproved `npm install` (`node_modules` absent) | Extracted Customer archive (`palm-metric-stage04n22-customer.zip`) contains unmodified Stage 04N.2.1 tests; Node ESM cannot resolve `firebase` or `react` without `node_modules` |

---

## 2. Exact File-by-File Inventory

### A. Admin App (`palm-metric-stage04n22-admin.zip` & `/app/applet`)

| File Path | Runner / Command | Test Count | Real Mock-Tx | Pure Unit | Static Rules / Config Audit | Constant Stubs | Read-Only Stage 04N.2.3 Result |
|---|---|---:|---:|---:|---:|---:|---|
| `scripts/stage04l.test.ts` | `npm test` (`tsx --test`) | **19** | 11 | 5 | 3 | 0 | **19 / 19 PASS** |
| `scripts/stage04m.test.ts` | `npm test` (`tsx --test`) | **9** | 6 | 1 | 2 | 0 | **9 / 9 PASS** |
| `scripts/stage04n.test.ts` | `npm test` (`tsx --test`) | **43** | 8 | 11 | 0 | 24 | **43 / 43 PASS** |
| `src/lib/productCustomizations.test.ts` | `npx tsx --test src/lib/productCustomizations.test.ts` | **10** | 0 | 9 | 1 | 0 | **10 / 10 PASS** |
| **Admin Total** | **`npm test` + `productCustomizations.test.ts`** | **81** | **25** | **26** | **6** | **24** | **81 / 81 PASS (0 Live Emulator)** |

#### Audit Finding on `STAGE_04N22_TEST_INVENTORY_REPORT.md`
1. `STAGE_04N22_TEST_INVENTORY_REPORT.md` reported `71` split into four arbitrary topic buckets (`19 + 18 + 14 + 20 = 71`) that do **not** correspond to actual test file boundaries (`19 + 9 + 43 = 71` in `scripts/*.test.ts`).
2. It omitted `src/lib/productCustomizations.test.ts` (`10` tests), under-reporting total Admin tests (`71` vs actual `81`).
3. It did not disclose that **24 of 43** tests in `scripts/stage04n.test.ts` (`02, 06, 07, 09, 10, 16–19, 23–25, 32–43`) are constant/stub boolean assertions (for example, `const canPromote = false; assert.equal(canPromote, false);`) that neither exercise application logic nor evaluate Firestore rules.
4. It omitted the Customer App test suite entirely.

---

### B. Customer App (`/tmp/stage04n23_verify/customer` from `palm-metric-stage04n22-customer.zip`)

| File Path | Test Mechanism | Test Count | Classification | Read-Only Stage 04N.2.3 Result |
|---|---|---:|---|---|
| `scripts/audit-rules.mjs` | Pure Node script (`assert` against `firestore.rules` + `firebase-blueprint.json`) | **1** script | Static legacy-rules & blueprint regex check | **PASS (`EXIT 0`)** |
| `scripts/stage04d.test.ts` | Custom `runTest(...)` harness (`passed/failed` counters) | **12** | Unit / schema / WhatsApp / i18n checks | **NOT EXECUTED** (`ERR_MODULE_NOT_FOUND: firebase`) |
| `scripts/stage04k.test.ts` | Custom `runTest(...)` harness | **17** | Validation / static rules & UI payload checks | **NOT EXECUTED** (`ERR_MODULE_NOT_FOUND: react`) |
| `scripts/stage04l.test.ts` | Custom `runTest(...)` harness | **20** | In-memory `MockFirestore` + Spark rules checks | **NOT EXECUTED** (`ERR_MODULE_NOT_FOUND: firebase`) |
| `scripts/stage04l1.test.ts` | Custom `runTest(...)` harness | **12** | In-memory `MockFirestore` concurrency & stock checks | **NOT EXECUTED** (`ERR_MODULE_NOT_FOUND: firebase`) |
| `scripts/stage04m.test.ts` | Custom `runTest(...)` harness | **8** | Integration & Spark rules checks | **NOT EXECUTED** (`ERR_MODULE_NOT_FOUND: firebase`) |
| `functions/src/__tests__/orderEngine.test.ts` | Legacy Blaze Jest/Vitest style (`it(...)`) | **20** *(inactive)* | Legacy Cloud Functions reference (unused on Spark) | **INACTIVE / NOT EXECUTED** |
| **Customer Active Spark Subtotal** | **5 TS scripts + 1 `.mjs` script** | **69** *(+1)* | **In-memory + static only (0 live Emulator)** | **1 PASS (`audit-rules.mjs`); 69 BLOCKED without `npm install`** |

---

## 3. Answers to Explicit Reconciliation Questions

1. **Which exact test files produced `71`?**
   - Admin `/app/applet/scripts/stage04l.test.ts` (`19`) + `scripts/stage04m.test.ts` (`9`) + `scripts/stage04n.test.ts` (`43`) via `npm test` (`tsx --test scripts/*.test.ts`).
2. **Which exact test files produced `118` (`82 + 36`)?**
   - **Customer `82`:** Active Customer Spark scripts (`12 + 17 + 20 + 12 + 8 = 69`) plus double-counted `scripts/stage04d.test.ts` (`+12`) and `scripts/audit-rules.mjs` (`+1`).
   - **Admin `36`:** Earlier upstream Admin baseline (`scripts/stage04l.test.ts` `18` + `scripts/stage04m.test.ts` `8` + `src/lib/productCustomizations.test.ts` `10`).
3. **Were any checks counted twice?**
   - In `118`: **Yes** (`12` tests in `stage04d.test.ts` + `1` `audit-rules.mjs` = `13` double-counted).
   - In Admin `71`: **No** double counting across files, though `STAGE_04N22_TEST_INVENTORY_REPORT.md` misrepresented the split (`19+18+14+20` instead of `19+9+43`) and omitted `src/lib/productCustomizations.test.ts` (`10`).
4. **Are static assertions included?**
   - **Yes.** Admin `71` includes `5` static file/rules assertions (`stage04l.test.ts` #2, #17&18, #20; `stage04m.test.ts` #1, #8) and `24` constant/stub assertions in `stage04n.test.ts` (plus `1` static rules check in `productCustomizations.test.ts`). Customer uses static regex checks inside `audit-rules.mjs`, `stage04k`, `stage04l`, `stage04l1`, and `stage04m`.
5. **Were all tests actually executed?**
   - **Admin (`81/81`):** Actually executed in Stage 04N.2.3 against `/app/applet` (which is byte-for-byte identical to the extracted Admin archive for all source/test files).
   - **Customer (`69` TS tests):** **NOT executed** in Stage 04N.2.3 from `palm-metric-stage04n22-customer.zip` because `node_modules` is not included in the archive and installing dependencies is prohibited under Stage 04N.2.3 read-only constraints. Only `scripts/audit-rules.mjs` executed (`PASS`).
6. **Are Customer and Admin results independently reproducible?**
   - **Admin:** Reproducible in `/app/applet` (where `node_modules` exists); an isolated extract of `palm-metric-stage04n22-admin.zip` requires `npm install` (excluded per read-only constraint) to run `tsc`/`vite`/`tsx`.
   - **Customer:** **Not reproducible** directly from `palm-metric-stage04n22-customer.zip` without running `npm install` (`node_modules` and root `package-lock.json` are absent; additionally Customer requires `@vis.gl/react-google-maps` and `adm-zip` not present in Admin's `node_modules`).
