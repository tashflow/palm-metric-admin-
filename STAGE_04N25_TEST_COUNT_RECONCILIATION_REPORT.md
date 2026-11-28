# STAGE 04N.2.5 — Test Count Reconciliation Report

**Audit Stage:** Stage 04N.2.5 (Strictly Read-Only Inventory & Execution Classification)  
**Scope:** Reconciling reported Customer (`90/90` vs `70/70`) and Admin (`36/36` vs `82/82`) totals directly from test source files.

---

## 1. Reconciliation of Conflicting Totals

| App | Claimed / Active Total | Exact Mathematical Derivation | Double Counting? | Status in Stage 04N.2.5 |
|---|---:|---|---|---|
| **Customer (Identity A claim)** | **90** | `70` active Spark tests + `20` inactive Blaze tests in `functions/src/__tests__/orderEngine.test.ts` | No file overlap, but mixes inactive Cloud Functions specs into Spark total | **Conflicting / Over-counted vs active Spark suite** |
| **Customer (Identity B active)** | **70** *(+1 static script)* | `12` (`stage04d`) + `17` (`stage04k`) + `20` (`stage04l`) + `12` (`stage04l1`) + `9` (`stage04m`) = **70** (+ `1` `audit-rules.mjs`) | **None** | **`70/70` PASS** *(via shared `node_modules`)*; **`audit-rules.mjs` PASS** *(bare standalone)* |
| **Admin (Identity A claim)** | **36** | Legacy upstream `54e5453` baseline (`stage04l` `18` + `stage04m` `8` + `productCustomizations` `10`) | None, but omits `stage04n.test.ts` (`43`) & Stage 04N.2.2/04N.2.4 (`+3`) | **Stale legacy baseline** |
| **Admin (Identity B actual)** | **82** | `72` via `npm test` (`19` `stage04l` + `10` `stage04m` + `43` `stage04n`) + `10` (`src/lib/productCustomizations.test.ts`) | **None** | **`82/82` PASS** in `/app/applet` and extracted archive *(includes `24` constant stubs in `stage04n.test.ts`)* |

---

## 2. Customer App File-by-File Breakdown (`palm-metric-stage04n24-customer.zip`)

| File Path | Runner / Harness | Total Tests | Real Unit / Mock-Tx Execution | Mixed Unit + Static Rules/Config Checks | Constant Stubs | Inactive Legacy | Stage 04N.2.5 Result |
|---|---|---:|---:|---:|---:|---:|---|
| `scripts/audit-rules.mjs` | Pure Node (`node`) | *(1 script)* | 0 | 1 script | 0 | 0 | **PASS (`EXIT 0`, standalone)** |
| `scripts/stage04d.test.ts` | `runTest(...)` (`tsx`) | **12** | 12 | 0 | 0 | 0 | **12 / 12 PASS** *(shared `node_modules`)* |
| `scripts/stage04k.test.ts` | `runTest(...)` (`tsx`) | **17** | 14 | 3 (#10, #15, #16 read source/rules) | 0 | 0 | **17 / 17 PASS** *(shared `node_modules`)* |
| `scripts/stage04l.test.ts` | `runTest(...)` (`tsx`) | **20** | 19 | 1 (#18 inspects rules/blueprint/UI) | 0 | 0 | **20 / 20 PASS** *(shared `node_modules`)* |
| `scripts/stage04l1.test.ts` | `runTest(...)` (`tsx`) | **12** | 9 | 3 (#1, #2, #10 inspect Spark rules) | 0 | 0 | **12 / 12 PASS** *(shared `node_modules`)* |
| `scripts/stage04m.test.ts` | `runTest(...)` (`tsx`) | **9** | 7 | 2 (#7, #9 inspect Spark rules/config) | 0 | 0 | **9 / 9 PASS** *(shared `node_modules`)* |
| `functions/src/__tests__/orderEngine.test.ts` | Legacy async `test(...)` | *(20 inactive)* | 0 | 0 | 0 | 20 | **INACTIVE / NOT EXECUTED** |
| **Customer Active Spark Total** | **5 TS files (+ 1 `.mjs`)** | **70** *(+1)* | **61** | **9** *(+1 script)* | **0** | **20 inactive** | **70 / 70 Executed (`0` Live Emulator)** |

---

## 3. Admin App File-by-File Breakdown (`/app/applet` & `palm-metric-stage04n24-admin.zip`)

| File Path | Runner / Command | Total Tests | Real Mock-Tx Integration | Pure Unit / Schema | Static Rules / Config Audit | Constant / Literal Stubs | Stage 04N.2.5 Result |
|---|---|---:|---:|---:|---:|---:|---|
| `scripts/stage04l.test.ts` | `npm test` (`tsx --test`) | **19** | 11 | 5 | 3 (#2, #17&18, #20) | 0 | **19 / 19 PASS** |
| `scripts/stage04m.test.ts` | `npm test` (`tsx --test`) | **10** | 6 | 1 | 3 (#1, #8, #10) | 0 | **10 / 10 PASS** |
| `scripts/stage04n.test.ts` | `npm test` (`tsx --test`) | **43** | 8 (#04, #21, #22, #26, #27, #28, #30, #31) | 11 (#01, #03, #05, #08, #11–#15, #20, #29) | 0 | **24** (#02, #06–#07, #09–#10, #16–#19, #23–#25, #32–#43) | **43 / 43 PASS** |
| `src/lib/productCustomizations.test.ts` | `npx tsx --test src/lib/productCustomizations.test.ts` | **10** | 0 | 9 | 1 (#10) | 0 | **10 / 10 PASS** |
| **Admin Total** | **`npm test` + `productCustomizations`** | **82** | **25** | **26** | **7** | **24** | **82 / 82 PASS (`0` Live Emulator)** |

---

## 4. Explicit Classification Findings

1. **No Duplicate Counting Within Present Set B (`70` + `82` = `152`):** Zero tests are counted twice inside either `70` (Customer) or `82` (Admin).
2. **Static Assertions Disclosure:** Static assertions against `firestore.spark.rules`, `firestore.rules`, `firebase-blueprint.json`, and `firebase-applet-config.json` are included in both suites (`9` mixed/static tests + `audit-rules.mjs` in Customer; `7` static/audit tests in Admin).
3. **Constant Stub Disclosure (`24` in Admin `stage04n.test.ts`):** Exactly `24` of `43` tests in `scripts/stage04n.test.ts` assert against local hardcoded constants (e.g., `const canPromote = false; assert.equal(canPromote, false);`). They provide **zero** runtime verification and are separated out explicitly above, leaving **58** substantive Admin tests + **70** substantive Customer tests (**128** substantive checks total).
4. **Live Emulator Count:** **`0`** across both applications due to `NO_JAVA`.
