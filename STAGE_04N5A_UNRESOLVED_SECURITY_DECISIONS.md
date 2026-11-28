# STAGE 04N.5A — UNRESOLVED SECURITY DECISIONS REPORT

- **Audit Stage:** `04N.5A — Unresolved Security Decisions`
- **Mode:** Strictly Read-Only Investigation (Zero Code Mutations)
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Date:** `2026-11-28`
- **Final Verdict:** **`PASS WITH LIMITATIONS`**

---

## 1. Unresolved Security & Provenance Items

1. **Live Production Rules Deployed Version (`UNRESOLVED`):**
   - It remains unverified whether live production Firestore currently runs legacy `firestore.rules`, the owner-supplied candidate ruleset, or hardened Spark rules. Authorized owner inspection of Firebase Console -> Firestore -> Rules is required.
2. **Admin Identity A Archive (`UNRESOLVED`):**
   - Identity A Admin archive (`c00e9e4c...`, `64` files) and Customer Identity A (`f98e5646...`, `143` files) remain missing locally. Identity B is verified, but formal owner retirement of Identity A is pending.
3. **External Customer Repo (`tashflow/Palm-Metric`) (`UNVERIFIED`):**
   - External live Customer repository is not mounted in this container; parity rests on verified Identity B archive evidence (`palm-metric-stage04n24-customer.zip`).
4. **Live Java Emulator Verification (`BLOCKED — NO_JAVA`):**
   - Dynamic rules unit tests have not been executed against a running Firestore Emulator due to `NO_JAVA`.
5. **`/settings/pricing` Active Client Usage (`UNVERIFIED`):**
   - While `orderRequests.ts` and `App.tsx` read `settings/pricing`, active Admin UI write forms for tax/discounts are unverified in Admin source code.
