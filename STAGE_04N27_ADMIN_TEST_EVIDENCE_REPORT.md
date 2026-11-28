# STAGE 04N.2.7 — Admin Test Evidence Report

**Audit Stage:** Stage 04N.2.7 (Strictly Read-Only Execution & Assertion-Quality Classification)  
**Working Directory:** `/app/applet`

---

## 1. Exact Command Execution Results

| Command | Working Directory | Exit Code | Total | Executed Real Tests | Constant / Stub Assertions | Failed | Skipped |
|---|---|---:|---:|---:|---:|---:|---:|
| `npm test` (`tsx --test scripts/*.test.ts`) | `/app/applet` | `0` | `72` | `48` | `24` *(all in `stage04n.test.ts`)* | `0` | `0` |
| `npx tsx --test src/lib/productCustomizations.test.ts` | `/app/applet` | `0` | `10` | `10` | `0` | `0` | `0` |
| Live Firebase Emulator (`auth`, `firestore`) | `/app/applet` | `1` *(blocked)* | `0` | `0` | `0` | `0` | `BLOCKED — NO_JAVA` |
| **Combined Admin Suite Total** | **`/app/applet`** | **`0`** | **`82`** | **`58`** | **`24`** | **`0`** | **`0` (Emulator blocked)** |

---

## 2. File-by-File Breakdown & `scripts/stage04n.test.ts` Separation

| File | Total Assertions | Genuine Mock-Tx Integration | Pure Unit / Schema | Static Rules / Config Audit | Constant / Literal Stub Assertions |
|---|---:|---:|---:|---:|---:|
| `scripts/stage04l.test.ts` | **19** | **11** | **5** | **3** (#2, #17&18, #20) | **0** |
| `scripts/stage04m.test.ts` | **10** | **6** | **1** | **3** (#1, #8, #10) | **0** |
| `scripts/stage04n.test.ts` | **43** | **8** (#04, #21, #22, #26, #27, #28, #30, #31) | **11** (#01, #03, #05, #08, #11–#15, #20, #29) | **0** | **24** (#02, #06–#07, #09–#10, #16–#19, #23–#25, #32–#43) |
| `src/lib/productCustomizations.test.ts` | **10** | **0** | **9** | **1** (#10) | **0** |
| **Admin Total** | **82** | **25** | **26** | **7** | **24** |

### Transparent Separation of `scripts/stage04n.test.ts` (`43` Cases)
- **Actual Executed Integration Tests (`8`):** `#04` (price override verify), `#21` & `#22` (insufficient/zero stock blocks promotion), `#26` (concurrent approvals), `#27` (duplicate replay idempotency), `#28` (failed tx rollback), `#30` & `#31` (replay metadata consistency).
- **Actual Executed Unit / Helper Tests (`11`):** `#01` (`normalizeOrderRequest`), `#03`, `#05`, `#11`–`#15` (`BOOTSTRAPPED_ADMIN_*`, `isBootstrappedAdminEmail`, `isVerifiedAdminIdentity`), `#08`, `#29` (`getOfficialOrderNumber`, `getDeterministicOrderId`), `#20` (fixture seed check).
- **Constant / Local-Literal Stubs (`24`):** `#02`, `#06`, `#07`, `#09`, `#10`, `#16`–`#19`, `#23`–`#25`, `#32`–`#43`. These check local hardcoded booleans or math literals without invoking app modules or Firestore rules and are **not** counted as functional integration tests.

---

## 3. Environment Limitation (`NO_JAVA`)

- `which java`: `NO_JAVA_BIN` (`java` absent); `npx --no-install firebase --version`: `15.36.0`.
- **Live Firestore Emulator Tests Executed:** **`0`** (all 25 integration checks above run against in-memory TypeScript transaction mocks, not the Java Firestore Emulator).
