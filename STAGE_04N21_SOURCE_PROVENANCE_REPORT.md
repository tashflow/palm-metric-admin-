# STAGE 04N.2.1 — Source Provenance Report

**Date:** 2026-11-25  
**Target Firebase Architecture:** Project `palm-metric-app`, Firestore `(default)`, Currency `SAR`, Fulfillment `pickup` only (Firebase Spark Plan / zero deployed Cloud Functions in runtime path)

---

## 1. Customer App Source Provenance

| Attribute | Verified Value |
|---|---|
| **Application Identity** | Palm Metric Customer App (`metadata.json`: `Verdant — Specialty Coffee & Kitchen`) |
| **Actual Source Directory** | `/tmp/stage04n2_customer_repo` (clean shallow clone) |
| **Git Repository & Branch** | `https://github.com/tashflow/Palm-Metric` (`main` -> `origin/main`) |
| **Exact Git Commit SHA** | `9f265abfcd54585613470f71072ee91855147ffa` (`9f265ab`: `chore: prepare architecture for Firebase Spark plan`) |
| **Uncommitted Modifications** | None in packaged archive (`palm-metric-stage04n21-customer.zip` was built strictly from `git ls-files` omitting legacy `.zip` files). Local `npm install` created an untracked `package-lock.json` on disk, which was excluded from the release archive. |
| **Package / App Version** | `package.json`: `"name": "react-example"`, `"version": "0.0.0"`, React `^19.0.1`, Vite `^8.3.0`, Firebase `^13.3.0` |
| **Firebase Project ID** | `src/lib/firebase.ts` hardcodes `projectId: "palm-metric-app"`, `getFirestore(app)` (`(default)`). *(Note: unused `firebase-applet-config.json` in this repo still references legacy remix project `universal-nomad-kwpgt`.)* |
| **Environment Config Requirements** | Optional `.env.example` vars (`VITE_FIREBASE_FUNCTIONS_REGION`, Google Maps key if enabled); install requires `npm install --legacy-peer-deps` (`vite@8.3.8` / `esbuild@0.25.x` peer range) |
| **Security Rules Version** | `rules_version = '2'` (`firestore.rules` = Stage 04E/legacy audit-passing rules; `firestore.spark.rules` = Stage 04K/04L/04L.1 Spark proposal) |

---

## 2. Admin App Source Provenance

| Attribute | Verified Value |
|---|---|
| **Application Identity** | Palm Metric Admin App (`metadata.json`: `Verda Admin — Specialty Coffee & Food Management`) |
| **Actual Source Directory** | `/app/applet` (no local `.git` directory; synchronized against clean clone `/tmp/stage04n2_admin_repo`) |
| **Upstream Git Repository & Branch** | `https://github.com/tashflow/palm-metric-admin-` (`main` -> `origin/main`) |
| **Upstream Base Commit SHA** | `54e545382681a4e114257e3d035e22b94708f8fa` (`54e5453`: `feat(orders): implement order requests management`) |
| **Local Modifications vs `54e5453`** | Modified relative to upstream HEAD `54e5453`: `package.json` (added `"test": "tsx --test scripts/*.test.ts"`), `src/components/AdminAccessModal.tsx` (read-only admin directory), `src/contexts/AuthContext.tsx` (`isBootstrappedAdminUid`), `src/lib/adminAllowlist.ts` (`tashfilartwork@gmail.com` added, `palmmatric1@gmail.com` typo removed, UIDs unified), `src/lib/authoritativePricing.ts` (`stockQuantity`/`stockCount` + `computeStockDeductionPlans`), `src/types/index.ts`, plus added `scripts/stage04n.test.ts` (including Stage 04N.2 TypeScript typing annotations) and Stage `04M2/04N/04N1/04N2/04N21` reports. |
| **Package / App Version** | `package.json`: `"name": "react-example"`, `"version": "0.0.0"`, React `^19.0.1`, Vite `^8.3.0`, Firebase `^13.3.0` |
| **Firebase Project ID** | `src/lib/firebase.ts` and `firebase-applet-config.json` both target `projectId: "palm-metric-app"`, `firestoreDatabaseId: "(default)"` |
| **Environment Config Requirements** | `.env.example` (`GEMINI_API_KEY`, `APP_URL`); Node `v22.23.5`, `npm install --legacy-peer-deps` |
| **Security Rules Version** | `rules_version = '2'` (`firestore.rules` = Stage 04B/04C untouched; `firestore.spark.rules` = Stage 04L Spark proposal) |

---

## 3. Architecture Compatibility Assessment
Both repositories initialize against `palm-metric-app` / `(default)` with SAR pickup-only semantics, bilingual `ar`/`en` UI, and `/orderRequests` -> `/orders` promotion designs. Specific cross-app contract drifts (`under_review` vs `reviewing`, `requestId` vs `sourceRequestId`, Admin runtime stock deduction wiring, allowlist spelling parity) are documented in `STAGE_04N21_CROSS_APP_CONTRACT_REPORT.md`.
