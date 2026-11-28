# STAGE 04N.7C — EMULATOR EXECUTION GUIDE

- **Audit Stage:** `04N.7C — Emulator Execution Guide`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## Reproducible Future Execution Guide (Java 17+ Environment)

1. **Prerequisites:**
   - Install Java 17+ (JDK).
   - Install Firebase CLI (`npm install -g firebase-tools`).
2. **Configuration (`firebase.json`):**
   - Point `firestore.rules` to `/app/applet/firestore.unified.candidate.rules`.
3. **Execution Command:**
   - Run `firebase emulators:start --only firestore`.
4. **Test Runner:**
   - Execute test suites utilizing `@firebase/rules-unit-testing`.
5. **Expected Outcome:**
   - All positive and negative test assertions pass successfully against the local Firestore Emulator instance.
