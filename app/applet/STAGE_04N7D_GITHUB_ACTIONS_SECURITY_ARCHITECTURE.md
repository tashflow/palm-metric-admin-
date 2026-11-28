# STAGE 04N.7D — GITHUB ACTIONS SECURITY ARCHITECTURE

- **Audit Stage:** `04N.7D — GitHub Actions Security Architecture`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Cloud Runner Architecture

- **Runner Environment:** GitHub-hosted `ubuntu-latest` runner.
- **Toolchain:** Java 21 (Temurin or Zulu JDK), Node.js LTS, Firebase CLI (`firebase-tools`), and `@firebase/rules-unit-testing`.
- **Demo Project Isolation:** Emulators bind strictly to demo project ID `demo-palm-metric-security`. Production credentials are never used or referenced.

---

## 2. Workflow Design & Safety Controls

- **Manual Trigger:** Initiated exclusively via `workflow_dispatch` (no automatic push triggers on sensitive branches).
- **Fail-Closed Guard:** Fails immediately if any project ID other than `demo-palm-metric-security` is detected in the test configuration.
- **Checksum Verification:** Automatically computes and verifies SHA-256 (`8bbe788edcd9b6d58d20fa0f8c949acc84ac50b0c116370bea1c2b23675b9aba`) before test execution.
- **Artifact Preservation:** Test logs and JUnit XML reports are archived as downloadable GitHub Actions artifacts (`upload-artifact`) with zero secret exposure.
