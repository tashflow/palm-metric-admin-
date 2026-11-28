# STAGE 04N.3C — PRODUCTION RULES PROVENANCE CONFIRMATION REPORT

- **Audit Stage:** `04N.3C — Production Rules Provenance Confirmation`
- **Mode:** Strictly Read-Only Investigation (Zero Code, Rules, Config, or Archive Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Backend Architecture:** Firebase Spark Free (Zero Cloud Functions)
- **Confirmed Workspace:** `/app/applet` (`Palm Metric Admin App` / `Verda Admin`)
- **Date:** `2026-11-28`
- **Final Verdict:** **`UNVERIFIED`**

---

## 1. Firebase Project and Database Identity

- **Firebase Project ID:** `palm-metric-app` (configured in `firebase-applet-config.json` and `src/lib/firebase.ts`).
- **Firestore Database ID:** `(default)` (multi-database default instance).
- **Architecture Environment:** Firebase Spark Free Plan (no Cloud Functions, no Blaze billing triggers, client-side SDK interacting directly with Firestore Security Rules).
- **Application Boundary:** Palm Metric Customer App and Palm Metric Admin App operate as separate application codebases and build outputs, sharing the common `palm-metric-app` Firestore database instance.

---

## 2. Local Deployment Provenance Findings

Inspection of the Admin workspace (`/app/applet`) and accessible archive directories revealed the following local provenance state:
1. **Absence of Deployment Configuration:**
   - `firebase.json` **does not exist** anywhere in the Admin workspace or container filesystem.
   - `.firebaserc` **does not exist** in the workspace.
   - `.git` version control history **does not exist** in `/app/applet`.
2. **CI/CD Workflow Scope:**
   - `/app/applet/.github/workflows/deploy.yml` builds static Vite output (`npm run build`) and deploys the `dist/` directory exclusively to **GitHub Pages**. It contains **zero** commands for Firebase CLI authentication, project selection, or Firestore Rules deployment (`firebase deploy --only firestore:rules`).
3. **Local Rules Files Present:**
   - `/app/applet/firestore.rules`: 387-line legacy ruleset (`20,068` bytes, SHA-256 `1845bf0...`). Copied verbatim by `src/lib/firestoreRulesText.ts` for the Admin UI manual rules notice.
   - `/app/applet/firestore.spark.rules`: 553-line hardened candidate ruleset (`33,516` bytes, SHA-256 `b43c958c...`). Excluded from deployment (`NOTE: Kept separate from production firestore.rules. Do NOT auto-deploy`).
4. **Conclusion on Local Provenance:** **No local file or build script proves which rules file was previously deployed to the live production Firestore instance.** Filenames and local file existence do not establish remote server enforcement.

---

## 3. Owner-Supplied Console Evidence

Analysis of the owner-supplied Firebase Console evidence (screenshots and rules text snippet):
1. **Unsafe `isAdmin()` Condition:** The displayed ruleset contains the legacy helper `isBootstrappedAdmin()` / `isAdmin()` utilizing `request.auth.token.firebase.sign_in_provider is string`.
2. **Direct Customer Order Writes:** The rules permit direct unverified client creation and updates on `/orders/{orderId}`.
3. **Unrestricted `/admins` and `/mediaAssets` Access:** Signed-in users are granted read and write access to `/admins` and `/mediaAssets`.
4. **Missing `/orderRequests` Match:** The supplied rules text contains **no** rule block for `/orderRequests`, causing customer order submissions to be blocked by the global safety net (`PERMISSION_DENIED`).
5. **Owner Statement:** The owner explicitly stated they have never personally edited or published these rules in the Firebase Console.
6. **UI State:** A **Publish** button was **not visible** in the supplied console screenshots, indicating a passive viewing or editor state rather than a confirmation dialog of a successful deployment action.

---

## 4. Rules Editor Versus Published Rules Distinction

It is critical to explicitly distinguish between the four distinct states of Firestore rules:
1. **Rules Currently Displayed in the Console Editor:** The text currently rendered in the browser text area when opening the Firebase Console Rules tab. This may be an unsaved draft, a default template, or a previously loaded version.
2. **Rules Confirmed as Successfully Published:** The version of the security rules compiled and activated on Google Cloud servers following an explicit server-side `Publish` action or Firebase CLI deployment.
3. **Rules Deployment History:** The audit trail of who published what rules version and when (accessible via Firebase Console release history or CLI deployment logs).
4. **Actual Live Production Enforcement:** The rules currently executing inside the Firestore backend evaluation engine for incoming client requests.

**Finding:** The supplied evidence captures the rules text displayed in a console editor view; it **does not** prove that this exact ruleset was successfully published or that it is actively enforcing live production traffic.

---

## 5. Publication History Evidence / Missing Evidence

- **Status:** **`OWNER CONSOLE VERIFICATION REQUIRED`**
- **Missing Evidence:** The current workspace lacks access to Firebase Console audit logs, CLI deployment command logs, or Firebase server release history for project `palm-metric-app`. Without authorized access to the Firebase Console project history, the exact publication timestamp and last successful deployment identity cannot be verified from this environment.

---

## 6. Security Risk Assessment

If the owner-supplied candidate ruleset is actively running in production, Palm Metric faces catastrophic security vulnerabilities:
1. **Admin Privilege Escalation:** Any authenticated Firebase user—including anonymous guest sessions (`sign_in_provider == 'anonymous'`) or unverified customer accounts—satisfies `sign_in_provider is string`, granting universal administrative read/write/delete across menu, pricing, billboards, customizations, orders, admins, and media assets.
2. **Direct Customer `/orders` Creation:** Customers bypass authoritative catalog price verification (`verifyAndPriceOrderRequest`), stock checks, and fee calculations, enabling order creation at `0.01 SAR` or negative totals.
3. **Customer Order Mutation:** Customers can update their own `/orders` records, altering fulfillment status (`Pending` -> `Ready`/`Completed`), quantities, or financial totals after placement.
4. **Unauthorized `/admins` Access:** Any signed-in user can read or write `/admins/{uid}`, enabling self-assigned admin privilege escalation and PII harvesting.
5. **Unauthorized `/mediaAssets` Access:** Any user can overwrite, delete, or inject malicious payloads into storefront media and promotional videos.
6. **Broken Checkout (`/orderRequests` Missing):** Customer checkout requests to `/orderRequests` fail with `PERMISSION_DENIED` due to the absence of collection rules.

---

## 7. Hardened Rules Comparison

- **Admin Hardened Candidate (`firestore.spark.rules`, `553` lines):**
  - Replaces `sign_in_provider is string` with `isNonAnonymousUser()` rejecting anonymous tokens.
  - Enforces allowlists (`2` UIDs, `4` verified emails).
  - Blocks customer `/orders` creation (`isValidPromotedOrderCreate` with cross-document `existsAfter`/`getAfter` verification).
  - Secures `/orderRequests`, nested `/auditLogs`, and `/orderNumbers` with immutable audit trails.
- **Customer Hardened Spark Rules (`775` lines):**
  - Implements Spark-compatible request queues and secure customer read/list owner scoping (`customerUid == request.auth.uid`).
- **Owner-Supplied Candidate:** Completely lacks all hardened primitives, exposing the application to pre-Stage-04B vulnerabilities.

---

## 8. Owner Verification Procedure (Manual Firebase Console Steps)

To definitively confirm Production Rules provenance, the project owner must perform the following manual steps in the Firebase Console:
1. **Open Firebase Console:** Navigate to [Firebase Console](https://console.firebase.google.com/) and select project **`palm-metric-app`**.
2. **Access Firestore Rules:** In the left sidebar under **Firestore Database**, click the **Rules** tab.
3. **Inspect Current Rules:** Compare the active editor rules against both legacy `firestore.rules` and hardened `firestore.spark.rules`.
4. **Check Release History / Version Control:**
   - Look for a **History** or **Versions** dropdown/tab near the top of the Rules editor.
   - Review the timestamp of the **last successful publication** and the UID/email of the publisher.
5. **CLI Deployment Log Check (Optional):** If deployments were ever run via CLI, check local shell history or CI logs for `firebase deploy --only firestore:rules`.

---

## 9. Unresolved Questions

1. Is the ruleset shown in the owner's screenshots actively deployed in production on `palm-metric-app`, or is it an uncommitted console draft?
2. When was the last successful rules publication executed for project `palm-metric-app`, and what rules content was published?
3. Did any previous build pipeline or manual deployment publish legacy `firestore.rules` or hardened `firestore.spark.rules`?

---

## 10. Exact Files Modified

- **Source, Rules, Configuration, Dependency, Lockfile, and Archive Files Modified:** **`ZERO (0)`**
- **Created Report:** `/STAGE_04N3C_PRODUCTION_RULES_PROVENANCE_REPORT.md`

---

## 11. Final Verdict

### **`UNVERIFIED`**

*(Production deployment provenance cannot be confirmed from local files or owner console screenshots because local deployment configs are absent and console evidence lacks publication history and timestamps. Owner console verification is required before any Stage 04O work or rules promotion.)*
