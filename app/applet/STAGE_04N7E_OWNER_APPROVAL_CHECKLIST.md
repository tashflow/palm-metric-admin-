# STAGE 04N.7E — OWNER APPROVAL CHECKLIST & DECISIONS

- **Audit Stage:** `04N.7E — Owner Approval Checklist`
- **Date:** `2026-11-28`

---

## 1. Owner Decisions Required Before Implementation

1. **Repository Initialization & Visibility:** Confirm whether the GitHub repository is private and whether GitHub Actions is enabled in repository settings.
2. **Workflow Authorization:** Approve the addition of a manual `workflow_dispatch` CI test runner file (`.github/workflows/firestore-rules-test.yml`).
3. **Runner Allowance Verification:** Verify GitHub account runner minute balance (2,000 free minutes/month for private repositories) via Android mobile browser.
4. **Customer Archive Separation:** Confirm that Customer App and Admin App repositories remain isolated and that proprietary Customer source code is not exposed.
5. **Cross-Device Testing Acknowledgment:** Acknowledge that browser emulation is used for cross-device viewport checks while physical Android testing is performed directly on the owner's phone.
