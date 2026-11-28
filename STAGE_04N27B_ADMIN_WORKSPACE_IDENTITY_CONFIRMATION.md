# STAGE 04N.2.7B — ADMIN WORKSPACE IDENTITY CONFIRMATION

- **Audit Stage:** `04N.2.7B — Admin Workspace Identity Confirmation`
- **Mode:** Strictly Read-Only Workspace Identity Verification
- **Timestamp:** `2026-11-27T21:22:28-08:00`
- **Workspace Identity Verdict:** **`CONFIRMED`**
- **Exact Workspace Root:** `/app/applet`

---

## 1. Executive Verdict

Independent, read-only inspection of `/app/applet` **CONFIRMS** that the currently open workspace IS the live **Palm Metric Admin App** (`Verda Admin — Specialty Coffee & Food Management` / `Palm Metric — Specialty Coffee & Food Admin`), targeting Firebase project **`palm-metric-app`** (`(default)` Firestore database).

- **Existing Files Modified:** `0` (strictly read-only; no source, config, dependency, rules, or archive files were edited, extracted, moved, or deleted; only this report file `STAGE_04N27B_ADMIN_WORKSPACE_IDENTITY_CONFIRMATION.md` was created).
- **Stage 04N.2.7 Resumption Gate:** Workspace identity is **`CONFIRMED`**; however, **Identity A** (`c00e9e4c...`) remains physically absent from this workspace (see Sections 5 & 7).

---

## 2. Direct Evidence Proving Admin Identity

All artifacts below were read directly from disk in `/app/applet`:

### 2.1 Metadata & HTML Entry (`metadata.json`, `index.html`, `package.json`)
- **`/app/applet/metadata.json`:**
  - `"name"`: `"Verda Admin — Specialty Coffee & Food Management"`
  - `"description"`: `"Minimalist admin management console for specialty coffee and matcha menus, promotional billboards, and real-time order fulfillment."`
- **`/app/applet/index.html`:**
  - `<html lang="ar" dir="rtl">`
  - `<title>`: `بالم مترك — لوحة إدارة القهوة المختصة والمخبوزات | Palm Metric`
  - `<meta name="description">`: `لوحة إدارة بالم مترك للقهوة المختصة والماتشا، إدارة القائمة والأسعار، لوحة الإعلانات، ومتابعة الطلبات المباشرة.`
  - `<meta property="og:title">`: `"Palm Metric — Specialty Coffee & Food Admin"`
  - `<meta property="og:description">`: `"Palm Metric bilingual Arabic & English admin console for specialty coffee, matcha, billboards, and live orders."`
  - Mounts `/src/main.tsx` (`<div id="root"></div>`).
- **`/app/applet/package.json`:**
  - `"name": "react-example"`, `"type": "module"`
  - Scripts: `dev` (`vite --port=3000 --host=0.0.0.0`), `build` (`vite build`), `preview` (`vite preview`), `clean`, `lint` (`tsc --noEmit`), `test` (`tsx --test scripts/*.test.ts`).
  - Dependencies (11 runtime + 9 dev): `react` `^19.0.1`, `react-dom` `^19.0.1`, `vite` `^8.3.0`, `firebase` `^13.3.0`, `@tailwindcss/vite` `^4.3.3`, `lucide-react`, `motion`, `express`, `dotenv`, `@google/genai`, `typescript` `^7.0.2`, `tsx` `^4.21.0`. Does **not** contain Customer-specific packages (`@vis.gl/react-google-maps`, `adm-zip`).

### 2.2 Source Structure, Admin Views & Tab Routing (`src/`)
- **Entry Point:** `/app/applet/src/main.tsx` renders `<App />` from `/app/applet/src/App.tsx`.
- **Root Dashboard (`src/App.tsx`):** Wraps `AdminDashboard` inside `LanguageProvider`, `ErrorBoundary`, and `AuthProvider`.
- **Admin Tab Routes (`AdminTab` in `src/types/index.ts:70` & `src/App.tsx:692-755`):**
  - `'requests'` → `OrderRequestsView` (`src/components/OrderRequestsView.tsx`) — incoming order-request review, verification, audit logs, promotion, and rejection.
  - `'orders'` → `LiveOrdersView` (`src/components/LiveOrdersView.tsx`) — active kitchen/barista fulfillment queue (`Pending`, `Preparing`, `Ready`, `Completed`, `Cancelled`).
  - `'menu'` → `MenuManagerView` (`src/components/MenuManagerView.tsx`), `CategoryManagerModal.tsx`, `CoffeeOptionsModal.tsx`, `ProductCustomizationsView.tsx`.
  - `'billboard'` → `BillboardManagerView` (`src/components/BillboardManagerView.tsx`).
  - `'customer'` → `CustomerStorefrontPreview` (`src/components/CustomerStorefrontPreview.tsx`) — internal preview tab plus external link to `CUSTOMER_APP_URL` (`https://tashflow.github.io/Palm-Metric/`).
- **Admin Workflow & Pricing Logic (`src/lib/`):**
  - `src/lib/orderRequests.ts` (`startOrderRequestReview`, `verifyOrderRequest`, `approveAndPromoteOrderRequest`, `rejectOrderRequest`, `subscribeAdminOrderRequests`, `normalizeStatus`)
  - `src/lib/authoritativePricing.ts`, `src/lib/productCustomizations.ts`, `src/lib/defaultMenu.ts`, `src/lib/modifiers.ts`, `src/lib/firestoreRulesText.ts`.

### 2.3 Admin Authentication & Authorization Modules
- **`/app/applet/src/contexts/AuthContext.tsx`:**
  - Uses Firebase Google Sign-In (`signInWithPopup(auth, googleProvider)`), rejecting and immediately signing out anonymous sessions (`if (currentUser.isAnonymous) await signOut(auth)`).
  - Resolves email from `user.email`, `providerData`, ID token claims, and `getAdditionalUserInfo(credential)` profile cache.
  - Authorizes access only when email verification holds AND identity matches either bootstrapped allowlist (`BOOTSTRAPPED_ADMIN_UIDS` / `BOOTSTRAPPED_ADMIN_EMAILS`) or an existing `admins/${currentUser.uid}` Firestore document.
- **`/app/applet/src/lib/adminAllowlist.ts`:**
  - `BOOTSTRAPPED_ADMIN_EMAILS`: `tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`
  - `BOOTSTRAPPED_ADMIN_UIDS`: `jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`
  - Exports `isBootstrappedAdminEmail`, `isBootstrappedAdminUid`, and `isVerifiedAdminIdentity`.
- **`/app/applet/src/components/LoginScreen.tsx` & `src/components/AdminAccessModal.tsx`:** Staff login gate (showing denial reasons `'unverified' | 'not_admin'`) and bootstrapped admin management modal.

---

## 3. Firebase Project Identity

Direct inspection of `/app/applet/firebase-applet-config.json` and `/app/applet/src/lib/firebase.ts`:

| Field | Value Observed |
|---|---|
| `projectId` | **`palm-metric-app`** |
| `firestoreDatabaseId` | **`(default)`** |
| `appId` | `1:522581928710:web:993ecee99d938707fc8c87` |
| `authDomain` | `palm-metric-app.firebaseapp.com` |
| `storageBucket` | `palm-metric-app.firebasestorage.app` |
| `messagingSenderId` | `522581928710` |
| `measurementId` | `G-2JWQ84KMLT` |
| SDK Init (`src/lib/firebase.ts:30-46`) | `initializeApp(firebaseConfig)` with `projectId: 'palm-metric-app'`, `db = getFirestore(app)` (targets `(default)`), `auth = getAuth(app)`, `storage = getStorage(app)`, `GoogleAuthProvider` (`select_account`), `handleFirestoreError` |

Confirmed: The configured and initialized Firebase project IS **`palm-metric-app`**.

---

## 4. Explicit Exclusion of Customer App or Another Project

`/app/applet` is **not** the Customer App (`Verdant — Specialty Coffee & Kitchen`) and **not** another project:
1. **External Storefront Reference:** `src/types/index.ts:72-73` defines `CUSTOMER_APP_DOMAIN = 'tashflow.github.io/Palm-Metric/'` and `CUSTOMER_APP_URL = 'https://tashflow.github.io/Palm-Metric/'`, and `src/App.tsx` links out to that separate Customer App while rendering `CustomerStorefrontPreview.tsx` only as an admin preview tab.
2. **Closed Staff Gate:** `src/App.tsx:95` refuses to subscribe to `orderRequests`, `orders`, `menuItems`, or `billboards` unless `user && isAdmin` is true (`AuthContext.tsx` forces sign-out on anonymous users). A customer storefront must allow public/anonymous guest browsing and checkout, which this codebase explicitly blocks.
3. **No Customer-App Codebase or Packages:** None of the Customer storefront modules (`CheckoutPage`, `OrderTrackerPage`, `GoogleMapsLocation`, `adm-zip`, `@vis.gl/react-google-maps`) exist in `/app/applet/src/` or `/app/applet/package.json`. Customer code exists in `/app/applet` solely inside archived read-only `.zip` files (`palm-metric-stage04n2*-customer.zip`), untouched.

---

## 5. Workspace-Only Archive Discovery Results (`/app/applet`)

Searched **only** `/app/applet` (skipping `node_modules`, `.git`, `dist`) without extracting, moving, renaming, or modifying any archive. Total `.zip` files found in `/app/applet`: **17**.

### 5.1 Target Matches (`palm-metric-stage04n24-admin.zip`, Identity A, Identity B)

| Target | Exact Path | File Count | Byte Size | SHA-256 | Result |
|---|---|---:|---:|---|---|
| **Named Target** (`palm-metric-stage04n24-admin.zip`) | `/app/applet/palm-metric-stage04n24-admin.zip` | `112` | `1,927,570` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **FOUND — MATCHES IDENTITY B** |
| **Identity A SHA-256** | *Not present anywhere in `/app/applet`* | *(expected `64`)* | *(expected `1,844,172`)* | `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f` | **NOT FOUND** (`0` binary matches; exists only as an unresolved hash reference inside historical `.md`/`.json` reports) |
| **Identity B SHA-256** | `/app/applet/palm-metric-stage04n24-admin.zip` | `112` | `1,927,570` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **FOUND ON DISK** |

### 5.2 Complete Inventory of All `.zip` Archives in `/app/applet` (17 Total)

| # | Exact Path | Files | Bytes | SHA-256 |
|---:|---|---:|---:|---|
| 1 | `/app/applet/palm-metric-stage04n24-admin.zip` | 112 | 1,927,570 | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` |
| 2 | `/app/applet/palm-metric-stage04n24-customer.zip` | 108 | 28,099,225 | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` |
| 3 | `/app/applet/palm-metric-stage04n22-admin.zip` | 98 | 1,893,684 | `032688b3a8ee577a76bcc64ea20c0a94a79dd2251ec1196db112599aa941a9e4` |
| 4 | `/app/applet/palm-metric-stage04n22-customer.zip` | 107 | 28,065,764 | `14254ac4e37e95f8fe12c33c846c1c059181259c191f53ddc5bd750fd1ca1e61` |
| 5 | `/app/applet/palm-metric-stage04n21-admin.zip` | 87 | 1,870,040 | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` |
| 6 | `/app/applet/palm-metric-stage04n21-customer.zip` | 108 | 28,096,952 | `e384f5db1b19829b6f2d19e8be3426d32b14cd95b556c98eb10edb0575313665` |
| 7 | `/app/applet/palm-metric-stage04n2-admin.zip` | 87 | 1,870,040 | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` |
| 8 | `/app/applet/palm-metric-stage04n2-customer.zip` | 109 | 28,141,602 | `1ed5781e6526a1b29aa40c84d299b515f1b6d9a84050055feeb0e55cf98be351` |
| 9 | `/app/applet/palm-metric-stage04n1-admin.zip` | 87 | 1,869,885 | `ad5c6ed98f7b5156a85e7e00aad8adec8fc3e41809e0a487585513ab1188fbbd` |
| 10 | `/app/applet/palm-metric-stage04n1-customer.zip` | 87 | 1,869,874 | `f7c15c7643f3f956be837be436630964c77ef2acbdc6eb4cd78963a1e1e00188` |
| 11 | `/app/applet/palm-metric-stage04n-admin.zip` | 81 | 1,865,395 | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` |
| 12 | `/app/applet/palm-metric-stage04n-customer.zip` | 81 | 1,865,395 | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` |
| 13 | `/app/applet/palm-metric-stage04m2-admin.zip` | 73 | 1,856,291 | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` |
| 14 | `/app/applet/palm-metric-stage04m2-customer.zip` | 73 | 1,856,291 | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` |
| 15 | `/app/applet/palm-metric-stage04m1-runnable.zip` | 65 | 1,839,171 | `b12db5159cae184db6b730ce5aacc44566a3f1e76bcbeb338c04c5715bce8e6d` |
| 16 | `/app/applet/palm-metric-stage04m-runnable.zip` | 61 | 1,834,970 | `66bfddbb654f3f32a53302bdcf4ab996a093f7e2ff78b7e1bf165b730ef8253d` |
| 17 | `/app/applet/palm-metric-admin-stage04l.zip` | 55 | 1,823,063 | `de62b84fb2c26cf6303bee58e37393372e71964c706dfb5a6a44d6499e0e709b` |

*(No `.git` directory exists in `/app/applet`.)*

---

## 6. Comparison with Stage 04N.2.7A and Conflicting Prior Reports

Independent re-verification against raw files on disk establishes how Stage 04N.2.7A compares with earlier conflicting reports:

| Report / Claim | Reported Finding | Direct Disk Evidence Check | Independent Reconciliation |
|---|---|---|---|
| **Stage 04N.2.7A** (`STAGE_04N27A_ADMIN_WORKSPACE_PREFLIGHT_REPORT.md`) | `/app/applet` is the Palm Metric Admin App (`Verda Admin`, `palm-metric-app`, 33 `src/` + 3 `scripts/` files); Identity B present (`112` / `1,927,570` / `be072ce3...`); Identity A absent (`c00e9e4c...`). Verdict: `PASS`. | Re-checked `metadata.json`, `index.html`, `package.json`, `firebase-applet-config.json`, `src/*`, and all 17 `.zip` hashes/counts directly. | **All factual claims in Stage 04N.2.7A are independently corroborated.** |
| **Stage 04N.2.6** (`STAGE_04N26_FINAL_ACCEPTANCE_REPORT.md`) | Reported `BLOCKED` when evaluating `/app/applet` as the **Customer App**, explicitly noting `/app/applet` is the **Admin App** (`Verda Admin`) and has no live Customer source tree. | Confirmed `/app/applet` is Admin, not Customer. | **Does NOT contradict Admin identity**—it was misread in later prompts as meaning `/app/applet` wasn't Admin, when it actually stated `/app/applet` *is* Admin and *not* Customer. |
| **Stage 04N.2.7 (`FAIL`)** (`STAGE_04N27_FINAL_ACCEPTANCE_REPORT.md`, `STAGE_04N27_ADMIN_WORKSPACE_IDENTITY_REPORT.md`) | Identified `/app/applet` as Admin (`Verda Admin`), verified Identity B (`112/112` parity), and returned `FAIL` because Identity A (`c00e9e4c...`) was missing and `NO_JAVA` blocked live Emulator. | Confirmed workspace identity and archive hashes match direct inspection. | **Workspace identity conclusion matches**, while `FAIL` stemmed from missing Identity A archive, test quality/emulator limits—not workspace absence. |
| **Upstream Identity A Report Claim** (cited in `STAGE_04N25_*` & Stage 04N.2.7 prompt) | Claimed `palm-metric-stage04n24-admin.zip` has `64` files, `1,844,172` bytes, SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f` (and `36/36` tests). | Not present anywhere in `/app/applet` (`0` matches). Closest sized snapshots on disk are Stage 04M/04M1 Admin ZIPs (`61`–`65` files). | **Unverified & contradicts on-disk Identity B (`112` files, `1,927,570` bytes, `be072ce3...`).** |

---

## 7. Exact Files Modified & Unresolved Contradictions

- **Exact Files Modified:** **Zero (`0`) existing workspace files modified.** Only this verification deliverable (`STAGE_04N27B_ADMIN_WORKSPACE_IDENTITY_CONFIRMATION.md`) was written.
- **Unresolved Contradictions:**
  1. **Identity A vs Identity B Archive Conflict (`UNRESOLVED`):** The workspace holds `/app/applet/palm-metric-stage04n24-admin.zip` as **Identity B** (`112` files, `1,927,570` bytes, SHA-256 `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6`). No binary file matching **Identity A** (`64` files, `1,844,172` bytes, SHA-256 `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f`) exists anywhere in `/app/applet`.
  2. *(Environment note observed during preflight: no `java` runtime is present, which blocks local Firebase Emulator execution if later verification steps require it, though live Emulator tests were prohibited in Stage 04N.2.7B.)*

---

## 8. Final Stage 04N.2.7B Determination

- **Workspace Identity Verdict:** **`CONFIRMED`**
- **Confirmed Workspace Root:** `/app/applet` (**Palm Metric Admin App** / `palm-metric-app` / `(default)`)
