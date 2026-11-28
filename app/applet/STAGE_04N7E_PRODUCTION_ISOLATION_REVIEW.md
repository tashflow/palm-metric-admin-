# STAGE 04N.7E — PRODUCTION ISOLATION REVIEW

- **Audit Stage:** `04N.7E — Production Isolation Review`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Isolation & Safety Controls

- **Demo Project Binding:** Proposed workflows must bind strictly to demo project ID `demo-palm-metric-security`.
- **Credential Protection:** Zero production credentials, service account keys, or live API tokens are permitted in CI runner environments.
- **Fail-Closed Safeguard:** The workflow must abort immediately if any project ID other than `demo-palm-metric-security` is detected.
- **Deployment Prohibition:** Deployment commands (`firebase deploy`) and production writes are strictly blocked and excluded from CI instructions.
