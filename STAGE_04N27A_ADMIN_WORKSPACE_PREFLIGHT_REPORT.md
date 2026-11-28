# STAGE 04N.2.7A — ADMIN WORKSPACE IDENTITY PREFLIGHT REPORT

- **Stage:** `04N.2.7A — Admin Workspace Identity Preflight`
- **Target:** `Palm Metric Admin App ONLY`
- **Mode:** `READ-ONLY WORKSPACE IDENTIFICATION`
- **Timestamp:** `2026-11-27T21:16:39-08:00`
- **Workspace Root Inspected:** `/app/applet`
- **Final Verdict:** **`PASS`** — Actual Palm Metric Admin App workspace is positively identified and accessible at `/app/applet`.

---

## 1. Current Application Identity

- **Identified Application:** **Palm Metric Admin App** (`Verda Admin — Specialty Coffee & Food Management` / `Palm Metric — Specialty Coffee & Food Admin`)
- **Primary Purpose:** Bilingual (Arabic RTL / English LTR) administrative management console for specialty coffee and matcha menus, product customizations, promotional billboards, incoming customer order-request verification/promotion, and live order fulfillment.
- **Standalone Workspace Root:** `/app/applet`

---

## 2. Direct Evidence Supporting Admin Identity

All evidence below was verified directly on disk in `/app/applet` during this preflight pass:

| Surface | Path | Direct Observed Evidence |
|---|---|---|
| Applet Metadata | `/app/applet/metadata.json` | `"name": "Verda Admin — Specialty Coffee & Food Management"`, `"description": "Minimalist admin management console for specialty coffee and matcha menus, promotional billboards, and real-time order fulfillment."` |
| HTML Entry Point | `/app/applet/index.html` | `<html lang="ar" dir="rtl">`, `<title>بالم مترك — لوحة إدارة القهوة المختصة والمخبوزات | Palm Metric</title>`, `<meta property="og:title" content="Palm Metric — Specialty Coffee & Food Admin" />`, `<script type="module" src="/src/main.tsx"></script>` |
| Package Manifest | `/app/applet/package.json` | `"name": "react-example"`, `"type": "module"`, scripts `dev`, `build`, `preview`, `clean`, `lint` (`tsc --noEmit`), `test` (`tsx --test scripts/*.test.ts`); 11 dependencies + 9 devDependencies (React 19, Vite 8, Tailwind CSS 4, Firebase 13.3, Lucide, Motion, Express, `@google/genai`, TypeScript 7, `tsx`) |
| Main Entry Point | `/app/applet/src/main.tsx` | Mounts `<App />` from `./App.tsx` onto `#root` |
| Root App Component | `/app/applet/src/App.tsx` | Renders `AdminDashboard` wrapped in `AuthProvider` and `LanguageProvider` with `AdminTab` navigation (`'requests' | 'orders' | 'menu' | 'billboard' | 'customer'`), `DEFAULT_CATEGORIES`, `subscribeAdminOrderRequests`, and `sanitizeFirestoreCustomization` |
| Admin UI Views & Modals | `/app/applet/src/components/` | `OrderRequestsView.tsx`, `LiveOrdersView.tsx`, `MenuManagerView.tsx`, `BillboardManagerView.tsx`, `ProductCustomizationsView.tsx`, `CoffeeOptionsModal.tsx`, `CategoryManagerModal.tsx`, `CustomerStorefrontPreview.tsx`, `CustomizationCustomerPreview.tsx`, `LoginScreen.tsx`, `AdminAccessModal.tsx`, `SummaryBar.tsx`, `FirestoreRulesNotice.tsx`, `LanguageSwitcher.tsx`, `ResolvedMedia.tsx`, `ErrorBoundary.tsx` |
| Admin Authentication & Allowlist | `/app/applet/src/contexts/AuthContext.tsx`, `/app/applet/src/lib/adminAllowlist.ts` | Rejects anonymous sessions (`if (currentUser.isAnonymous) await signOut(auth)`), validates Google OAuth / verified emails against `BOOTSTRAPPED_ADMIN_EMAILS` (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`), `BOOTSTRAPPED_ADMIN_UIDS` (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`), or `admins/${uid}` Firestore documents via `isVerifiedAdminIdentity()` |
| Admin Order-Management Engine | `/app/applet/src/lib/orderRequests.ts`, `/app/applet/src/lib/authoritativePricing.ts` | Subscribes to incoming requests (`subscribeAdminOrderRequests`), normalizes legacy statuses (`under_review`, `in_review` → `'reviewing'`; `price_verified` → `'verified'`), performs deterministic order ID/number generation (`ord_<sanitized>`, `PM-<6digits>`), transactional verification/promotion/rejection, and stock deduction plans |
| Type Contracts | `/app/applet/src/types/index.ts` | Defines `AdminTab`, `CUSTOMER_APP_DOMAIN = 'tashflow.github.io/Palm-Metric/'`, `CUSTOMER_APP_URL = 'https://tashflow.github.io/Palm-Metric/'`, `OrderStatus`, `MenuItem`, `BillboardAd`, `ProductCustomization`, `OrderRequest` |
| Firebase Configuration | `/app/applet/firebase-applet-config.json`, `/app/applet/src/lib/firebase.ts` | `projectId: "palm-metric-app"`, `firestoreDatabaseId: "(default)"`, `authDomain: "palm-metric-app.firebaseapp.com"`, `storageBucket: "palm-metric-app.firebasestorage.app"`, `appId: "1:522581928710:web:993ecee99d938707fc8c87"` |

---

## 3. Explicit Distinction from Customer App

`/app/applet` is **unambiguously the Palm Metric Admin App**, **not** the Palm Metric Customer App:

1. **Application Scope & Branding:** `metadata.json` and `index.html` explicitly declare the **Admin management console** (`Verda Admin` / `Palm Metric — Specialty Coffee & Food Admin`), whereas the Customer storefront is referenced strictly as an external target (`CUSTOMER_APP_URL = "https://tashflow.github.io/Palm-Metric/"`) and rendered only via an admin preview component (`CustomerStorefrontPreview.tsx`).
2. **Routing & UI Components:** All primary views (`OrderRequestsView`, `LiveOrdersView`, `MenuManagerView`, `BillboardManagerView`, `ProductCustomizationsView`, `AdminAccessModal`) implement internal staff operations—menu CRUD, billboard uploads, category configuration, allowlist gating, and order-request promotion—rather than customer cart/checkout/map storefront flows.
3. **Auth Model:** `AuthContext.tsx` explicitly blocks anonymous auth and enforces bootstrapped admin email/UID or `admins/{uid}` verification before opening dashboard subscriptions (`authLoading || !user || !isAdmin`).
4. **Why Prior Confusion Occurred:** Stage 04N.2.6 searched `/app/applet` specifically for the *Customer* workspace and reported `BLOCKED` precisely because `/app/applet` is the separate **Admin** workspace (only archival `.zip` snapshots of Customer builds exist inside `/app/applet`, not a live Customer source tree). No separate Customer source workspace exists under `/app`, `/tmp`, `/workspace`, `/mnt`, or `/root`.

---

## 4. Workspace Structure & Dependency Availability

- **Actual Workspace Root:** `/app/applet`
- **Admin Source Tree Availability:** **Available and Complete**
  - `src/` contains **33 files** (`src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/assets/images/login_coffee_bar_1794541456987.jpg`, `16` components, `2` contexts, `1` i18n file, `7` lib modules + `1` colocated lib test, `1` types file).
  - `scripts/` contains **3 test suites** (`scripts/stage04l.test.ts`, `scripts/stage04m.test.ts`, `scripts/stage04n.test.ts`).
- **Admin Dependency Directory Availability:** **Available (`node_modules/` present)**
  - `node_modules/` contains **283 package directory entries** (including scoped `@*` package subdirectories).
  - `node_modules/.bin/` contains **14 executables**: `autoprefixer`, `baseline-browser-mapping`, `browserslist`, `crashlytics-setconstants`, `esbuild`, `jiti`, `mime`, `nanoid`, `proto-loader-gen-types`, `rolldown`, `tsc`, `tsx`, `update-browserslist-db`, `vite`.
- **Java Runtime Availability (Environment Note):** `which java` returned `NO_JAVA_BIN` (not required for workspace identification preflight, noted for any later local Firebase Emulator step).

---

## 5. Archive Discovery Across Accessible Paths

Recursive search across `/app`, `/tmp`, `/workspace`, `/mnt`, and `/root` (excluding `node_modules` and `.git`) discovered **17 `.zip` files**, all located directly inside `/app/applet/`:

| # | Path | File Count | Byte Size | SHA-256 | Match Status |
|---:|---|---:|---:|---|---|
| 1 | `/app/applet/palm-metric-stage04n24-admin.zip` | **112** | **1,927,570** | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **Matches Identity B (Admin)** |
| 2 | `/app/applet/palm-metric-stage04n24-customer.zip` | 108 | 28,099,225 | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` | Customer Archive (Identity B) |
| 3 | `/app/applet/palm-metric-stage04n22-admin.zip` | 98 | 1,893,684 | `032688b3a8ee577a76bcc64ea20c0a94a79dd2251ec1196db112599aa941a9e4` | Historical Stage 04N.2.2 Admin |
| 4 | `/app/applet/palm-metric-stage04n22-customer.zip` | 107 | 28,065,764 | `14254ac4e37e95f8fe12c33c846c1c059181259c191f53ddc5bd750fd1ca1e61` | Historical Stage 04N.2.2 Customer |
| 5 | `/app/applet/palm-metric-stage04n21-admin.zip` | 87 | 1,870,040 | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` | Historical Stage 04N.2.1 Admin |
| 6 | `/app/applet/palm-metric-stage04n21-customer.zip` | 108 | 28,096,952 | `e384f5db1b19829b6f2d19e8be3426d32b14cd95b556c98eb10edb0575313665` | Historical Stage 04N.2.1 Customer |
| 7 | `/app/applet/palm-metric-stage04n2-admin.zip` | 87 | 1,870,040 | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` | Historical Stage 04N.2 Admin |
| 8 | `/app/applet/palm-metric-stage04n2-customer.zip` | 109 | 28,141,602 | `1ed5781e6526a1b29aa40c84d299b515f1b6d9a84050055feeb0e55cf98be351` | Historical Stage 04N.2 Customer |
| 9 | `/app/applet/palm-metric-stage04n1-admin.zip` | 87 | 1,869,885 | `ad5c6ed98f7b5156a85e7e00aad8adec8fc3e41809e0a487585513ab1188fbbd` | Historical Stage 04N.1 Admin |
| 10 | `/app/applet/palm-metric-stage04n1-customer.zip` | 87 | 1,869,874 | `f7c15c7643f3f956be837be436630964c77ef2acbdc6eb4cd78963a1e1e00188` | Historical Stage 04N.1 Customer-named Admin |
| 11 | `/app/applet/palm-metric-stage04n-admin.zip` | 81 | 1,865,395 | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` | Historical Stage 04N Admin |
| 12 | `/app/applet/palm-metric-stage04n-customer.zip` | 81 | 1,865,395 | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` | Identical Byte Duplicate of #11 |
| 13 | `/app/applet/palm-metric-stage04m2-admin.zip` | 73 | 1,856,291 | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` | Historical Stage 04M.2 Admin |
| 14 | `/app/applet/palm-metric-stage04m2-customer.zip` | 73 | 1,856,291 | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` | Identical Byte Duplicate of #13 |
| 15 | `/app/applet/palm-metric-stage04m1-runnable.zip` | 65 | 1,839,171 | `b12db5159cae184db6b730ce5aacc44566a3f1e76bcbeb338c04c5715bce8e6d` | Historical Stage 04M.1 Runnable |
| 16 | `/app/applet/palm-metric-stage04m-runnable.zip` | 61 | 1,834,970 | `66bfddbb654f3f32a53302bdcf4ab996a093f7e2ff78b7e1bf165b730ef8253d` | Historical Stage 04M Runnable |
| 17 | `/app/applet/palm-metric-admin-stage04l.zip` | 55 | 1,823,063 | `de62b84fb2c26cf6303bee58e37393372e71964c706dfb5a6a44d6499e0e709b` | Historical Stage 04L Admin |

---

## 6. Identity A vs Identity B Admin Archive Availability

- **Identity A Admin Archive** (`palm-metric-stage04n24-admin.zip`, expected `64` files, `1,844,172` bytes, SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f`):
  - **Status:** **`UNRESOLVED — NOT FOUND ON DISK`** across `/app`, `/tmp`, `/workspace`, `/mnt`, and `/root`.
- **Identity B Admin Archive** (`palm-metric-stage04n24-admin.zip`, `112` files, `1,927,570` bytes, SHA-256 `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`):
  - **Status:** **`PRESENT ON DISK`** at `/app/applet/palm-metric-stage04n24-admin.zip`.
  - Spot inspection confirmed it packages the Admin workspace files (`metadata.json`, `index.html`, `package.json`, `firebase-applet-config.json`, `src/App.tsx`, `src/components/OrderRequestsView.tsx`, `src/components/LiveOrdersView.tsx`, `src/components/MenuManagerView.tsx`, `src/components/BillboardManagerView.tsx`, etc.).

---

## 7. Unresolved Issues & Resumption Readiness

1. **Exact Unresolved Issues Carried Into Stage 04N.2.7:**
   - **Missing Identity A Binary:** The `64`-file / `1,844,172`-byte / `c00e9e4c...` archive does not exist in any accessible filesystem location (`/app`, `/tmp`, `/workspace`, `/mnt`, `/root`). It cannot be hashed or extracted unless supplied from an external store.
   - **No Java Runtime (`NO_JAVA_BIN`):** Local Firebase Firestore Emulator execution is unavailable in this container environment.
2. **Can Stage 04N.2.7 Safely Resume?**
   - **Yes** — Stage 04N.2.7 can safely target `/app/applet` as the confirmed **Palm Metric Admin App** workspace and independently inspect/verify the live Admin source tree and the on-disk **Identity B** archive (`/app/applet/palm-metric-stage04n24-admin.zip`), while explicitly marking **Identity A** (`c00e9e4c...`) as unresolved/unavailable on disk.

---

## 8. Preflight Verdict

- **Verdict:** **`PASS`**
- **Rationale:** `/app/applet` is positively verified via metadata, entry points, routes/components, admin allowlist/auth logic, order-management logic, Firebase configuration (`palm-metric-app`), and installed `node_modules` to be the **Palm Metric Admin App** workspace. Stage 04N.2.7 may proceed strictly against `/app/applet` and `/app/applet/palm-metric-stage04n24-admin.zip` (Identity B), with Identity A (`c00e9e4c...`) explicitly documented as absent on disk.
