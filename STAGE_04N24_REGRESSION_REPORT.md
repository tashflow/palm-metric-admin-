# STAGE 04N.2.4 — Regression & Verification Inventory Report

## 1. Customer App Independent Verification (`/tmp/stage04n24_verify_extract/customer`)
| Check Command | Scope | Result | Count |
| :--- | :--- | :--- | :--- |
| `npx tsc --noEmit` | Full TypeScript typecheck | PASS | 0 errors |
| `npx vite build` | Production Vite client bundle | PASS | Built in 1.54s |
| `node scripts/audit-rules.mjs` | Static rules + blueprint schema audit | PASS | 1 static suite |
| `npx tsx scripts/stage04d.test.ts` | Cart customizations, halalas rounding, WhatsApp, Stage 04D/04E i18n | PASS | 12 / 12 |
| `npx tsx scripts/stage04k.test.ts` | Customer `/orderRequests`, UID binding, `requestReference`, Spark rules, `under_review -> reviewing` | PASS | 17 / 17 |
| `npx tsx scripts/stage04l.test.ts` | Review/verify/promote workflow, concurrent locks, tracker snapshot, Spark rules, nested `auditLogs` | PASS | 20 / 20 |
| `npx tsx scripts/stage04l1.test.ts` | Hardening: allowlist, unauthorized audit blocks, stock oversell/atomic rollback, FNV-1a collisions | PASS | 12 / 12 |
| `npx tsx scripts/stage04m.test.ts` | E2E interop, allowlist parity, legacy order compat, Stage 04N.2.4 contract convergence | PASS | 9 / 9 |

- **Customer Automated Sub-Total:** **70 passed, 0 failed** (+ 1 static rules/blueprint audit script).

## 2. Admin App Independent Verification (`/tmp/stage04n24_verify_extract/admin`)
| Check Command | Scope | Result | Count |
| :--- | :--- | :--- | :--- |
| `npm run lint` (`tsc --noEmit`) | Full TypeScript typecheck | PASS | 0 errors |
| `npm run build` (`vite build`) | Production Vite client bundle | PASS | Built in 1.24s |
| `npx tsx --test scripts/stage04l.test.ts` | OrderRequest normalization, `reviewing` workflow, halala pricing, atomic stock, rules & blueprint | PASS | 19 / 19 |
| `npx tsx --test scripts/stage04m.test.ts` | Stage 04M interop, `under_review`/`in_review` -> `reviewing`, `totalSar`/`totalBillSar`, dual UIDs/emails, `palm-metric-app` config | PASS | 10 / 10 |
| `npx tsx --test scripts/stage04n.test.ts` | Security, auth fail-closed, concurrency/idempotency, inventory bounds, pricing, legacy compat | PASS | 43 / 43 |
| `npx tsx --test src/lib/productCustomizations.test.ts` | Customization schema validation, sanitization, SAR decimal math, legacy `firestore.rules` guard | PASS | 10 / 10 |

- **Admin Automated Sub-Total:** **82 passed, 0 failed**.

## 3. Combined Verification Count
- **Customer + Admin Automated Tests (re-run cleanly from extracted archives):** **152 passed, 0 failed** (70 Customer + 82 Admin), plus 1 static audit script (`audit-rules.mjs`) and 1 live cross-module TypeScript round-trip check (`CROSS_APP_ROUNDTRIP_PASS`).
- **Evidence Distinction:** Unit/integration tests execute deterministic in-memory Firestore transaction adapters and static file assertions against `firestore.spark.rules`, `firestore.rules`, `firebase-blueprint.json`, and `firebase-applet-config.json`. Live Firebase Emulator execution status is documented honestly in `STAGE_04N24_EMULATOR_STATUS_REPORT.md`.
