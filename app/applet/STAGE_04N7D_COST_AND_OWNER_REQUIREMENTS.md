# STAGE 04N.7D — COST AND OWNER REQUIREMENTS

- **Audit Stage:** `04N.7D — Cost and Owner Requirements`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Cost & Resource Controls

- **GitHub Free Allowance:** 2,000 free private repository runner minutes per month. Emulator test runs take ~1-2 minutes each, well within free-tier limits.
- **Billing Prevention:** Zero paid services or billing upgrades required; repository remains private without incurring overages.
- **Artifact Retention:** Artifact storage configured for standard 7-day retention to prevent storage bloat.

---

## 2. Android Mobile Control Sequence

1. Open GitHub in Android Chrome (Desktop Site mode if preferred).
2. Navigate to the Palm Metric Admin repository.
3. Select the **Actions** tab.
4. Choose the Firestore Rules CI workflow.
5. Tap **Run workflow** (`workflow_dispatch`).
6. Monitor progress in real time via the mobile browser.
7. Open workflow run logs upon completion.
8. Download test report artifacts (`test-results.xml`).
9. Review PASS/FAIL status and re-run if necessary.
