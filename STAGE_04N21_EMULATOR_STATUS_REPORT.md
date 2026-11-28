# STAGE 04N.2.1 — Firebase Emulator Status Report

**Date:** 2026-11-25  
**Target Firebase Project:** `palm-metric-app` (`(default)` Firestore database)  
**Live Emulator Execution Status:** **BLOCKED (`NO_JAVA`)**

---

## 1. Java & Tooling Check

| Dependency | Check Command | Result | Status |
|---|---|---|---|
| Java Runtime (JVM) | `which java; java -version` | `sh: 1: java: not found` | **Missing (`NO_JAVA`)** |
| Firebase CLI | `firebase --version` | `15.36.0` | Installed |
| Node.js / npm | `node -v && npm -v` | `v22.23.5` / `10.9.9` | Installed |

---

## 2. Exact Emulator Startup Failure

Executed inside Customer repository (`/tmp/stage04n2_customer_repo`, where `firebase.json` exists):

```text
Command: firebase emulators:exec --only auth,firestore --project palm-metric-app "echo ok"
Exit Code: 1
Output:
i  emulators: Shutting down emulators.
Error: Could not spawn `java -version`. Please make sure Java is installed and on your system PATH.
```

*(In Admin `/app/applet`, no `firebase.json` exists and Java is likewise absent.)*

---

## 3. Verification Boundary & Honesty Statement
- **Live Firebase Emulator execution is `BLOCKED` due to `NO_JAVA`.**
- Neither repository includes `@firebase/rules-unit-testing` or an `"emulators"` port configuration block in `firebase.json`.
- All passing suites in this stage use in-memory transactional mocks and static rules assertions—**they are NOT live Firebase Emulator tests and do not constitute production security rules execution verification.**
- Per Stage 04N.2.1 rules, Java installation or paid infrastructure is not required in this container; resolving live Emulator verification simply requires running `@firebase/rules-unit-testing` against `firestore.spark.rules` in a Java-enabled (OpenJDK 17/21) local or CI runner.
