# STAGE 04N.2.5 — Emulator Limitation Report

**Audit Stage:** Stage 04N.2.5  
**Target:** Firebase Local Emulator Suite (`auth`, `firestore`) for `palm-metric-app` (`(default)`)

---

## 1. Direct Environment Probe Results

Executed directly in `/app/applet`:
- `which java`: **Not found** (`NO_JAVA_BIN`)
- `java -version`: **`sh: 1: java: not found`**
- `npx --no-install firebase --version`: **`15.36.0`** (Firebase CLI is installed)

---

## 2. Verification Impact

- **Live Firestore Security Rules Evaluation:** **BLOCKED (`NO_JAVA`)** — Real `@firebase/rules-unit-testing` assertions against `firestore.spark.rules` could not run.
- **Live Transaction / Optimistic Concurrency Execution:** **BLOCKED (`NO_JAVA`)** — Real multi-client Firestore transaction contention on `/orderRequests/{requestId}`, `/orders/ord_{requestId}`, `/orderNumbers/{orderNumber}`, and `/menu/{itemId}` stock deduction remains unverified against the real Firestore Emulator engine.
- **Safety Boundaries Preserved:** Zero production Firebase writes, zero changes to frozen `firestore.rules`, zero deployments, and zero Java runtime installations were performed.

---

## 3. Remediation Prerequisite

In a host environment equipped with OpenJDK 17+ (`java` on `PATH`), run:

```bash
firebase emulators:exec --only auth,firestore --project palm-metric-app "<test-command>"
```

to validate `firestore.spark.rules` and real Firestore transaction rollback/atomicity end-to-end before declaring production release readiness.
