# STAGE 04N.2.7 — Admin Workspace Identity Report

**Audit Stage:** Stage 04N.2.7 (Strictly Read-Only Verification)  
**Target:** Palm Metric Admin App Only  
**Verified Workspace Path:** `/app/applet`

---

## 1. Workspace Identity Confirmation

Independent inspection of `/app/applet` (without assuming identity) confirms **`/app/applet` IS the live Palm Metric Admin App workspace**:

- **Application Metadata (`metadata.json`):**
  - `name`: `"Verda Admin — Specialty Coffee & Food Management"`
  - `description`: `"Minimalist admin management console for specialty coffee and matcha menus, promotional billboards, and real-time order fulfillment."`
- **HTML Entry Metadata (`index.html`):**
  - `<title>`: `بالم مترك — لوحة إدارة القهوة المختصة والمخبوزات | Palm Metric`
  - `og:title`: `Palm Metric — Specialty Coffee & Food Admin`
- **Package Manifest (`package.json`):**
  - `scripts`: `dev`, `build`, `preview`, `clean`, `lint` (`tsc --noEmit`), `test` (`tsx --test scripts/*.test.ts`).
  - Dependencies (`21` packages total: `11` runtime + `10` dev): React 19, Vite 8, Tailwind 4, Firebase 13.3, Lucide icons, Motion, Express, TypeScript 7, `tsx`. Excludes Customer-only packages (`@vis.gl/react-google-maps`, `adm-zip`).
- **Entry Points & UI Views (`src/`):**
  - Entry: `src/main.tsx`, `src/App.tsx`
  - Admin UI Views & Modals (`src/components/`): `OrderRequestsView.tsx`, `LiveOrdersView.tsx`, `MenuManagerView.tsx`, `BillboardManagerView.tsx`, `ProductCustomizationsView.tsx`, `CoffeeOptionsModal.tsx`, `CategoryManagerModal.tsx`, `CustomerStorefrontPreview.tsx`, `CustomizationCustomerPreview.tsx`, `LoginScreen.tsx`, `AdminAccessModal.tsx`, `SummaryBar.tsx`.
- **Admin Authentication & Authorization Modules:**
  - `src/contexts/AuthContext.tsx` & `src/lib/adminAllowlist.ts` enforcing dual Admin UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and 4 canonical Admin emails (`tashflow26@gmail.com`, `palmmetric1@gmail.com`, `palmmatric1@gmail.com`, `tashfilartwork@gmail.com`).
- **Admin Firebase Integration:**
  - `firebase-applet-config.json` & `src/lib/firebase.ts`: bound to `projectId: "palm-metric-app"`, `firestoreDatabaseId: "(default)"`.
  - Admin Order Request Workflow Engine: `src/lib/orderRequests.ts`, `src/lib/authoritativePricing.ts`, `src/lib/productCustomizations.ts`.

---

## 2. Explicit Distinction From Customer App

| Attribute | Verified Admin App (`/app/applet`) | Customer App (`palm-metric-stage04n24-customer.zip`) |
|---|---|---|
| `metadata.json` Name | `Verda Admin — Specialty Coffee & Food Management` | `Verdant — Specialty Coffee & Kitchen` |
| Entry UI Components | `OrderRequestsView`, `LiveOrdersView`, `MenuManagerView`, `BillboardManagerView`, `ProductCustomizationsView`, `LoginScreen` | `CheckoutPage`, `OrderTrackerPage`, `MenuPage`, `GoogleMapsLocation`, `AdminOrderRequestsPage` |
| Auth / Allowlist Module | `src/lib/adminAllowlist.ts` + `src/contexts/AuthContext.tsx` | `src/lib/adminAuth.ts` + anonymous/guest customer auth |
| Customer-Only Dependencies | Absent | `@vis.gl/react-google-maps`, `adm-zip` |
| Workspace Separation | `/app/applet` kept completely isolated | Stored only as read-only `.zip` snapshots; untouched |
