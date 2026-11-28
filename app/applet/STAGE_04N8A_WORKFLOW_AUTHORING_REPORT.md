# STAGE 04N.8A — MANUAL GITHUB ACTIONS SECURITY CI WORKFLOW AUTHORING REPORT

- **Stage:** `04N.8A — CI Workflow Authoring`
- **Target Workspace:** `/app/applet`
- **Firebase Project:** `palm-metric-app` (isolated via `demo-palm-metric-security` in CI)
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Exact Files Created or Modified

1. **Created:** `.github/workflows/firestore-rules-security-test.yml`
2. **Modified:** **`ZERO (0)`** existing source files, production rules (`firestore.rules`, `firestore.spark.rules`), or configuration files.

---

## 2. Workflow Trigger & Job Structure

- **Trigger:** `workflow_dispatch` ONLY (manual initiation from Android mobile browser; zero automatic triggers).
- **Runner:** GitHub-hosted `ubuntu-latest`.
- **Toolchain:** Java 21 (`actions/setup-java@v4`), Node.js 22 LTS (`actions/setup-node@v4`), pinned Firebase CLI (`firebase-tools@13.15.4`).
- **Permissions:** Least-privilege `contents: read`.
- **Timeout:** `timeout-minutes: 15`.
- **Artifacts:** `upload-artifact@v4` with 7-day retention.

---

## 3. Candidate Checksum Verification Result

- **Candidate Path:** `firestore.unified.candidate.rules`
- **Expected SHA-256:** `8bbe788edcd9b6d58d20fa0f8c949acc84ac50b0c116370bea1c2b23675b9aba`
- **Verification Logic:** Automatically computed via `sha256sum` in CI before test execution; fails immediately if hash mismatch occurs.

---

## 4. Test Coverage Implemented

- Stage 04N 43-test suite (`scripts/stage04n.test.ts`) covering:
  - Unauthenticated access denial and anonymous rejection.
  - Customer ownership isolation and unauthorized admin denial.
  - Admin whitelist enforcement (`isVerifiedAdminToken()`).
  - Order and inventory stock validation and concurrency/idempotency.
  - Audit log and anti-mutability protections.

---

## 5. Production Isolation Evidence

- **Demo Project ID:** `demo-palm-metric-security`.
- **Credential Protection:** Zero production secrets or API keys are used or referenced.
- **Fail-Closed Safeguard:** Workflow strictly isolates the Firestore Emulator to the demo project.

---

## 6. Unresolved Limitations & Confirmation

- **Execution Status:** Workflow authoring complete; zero GitHub push or workflow execution has occurred locally or in production.
- **Production Safety:** Production rules and live database remain 100% untouched and pristine.
