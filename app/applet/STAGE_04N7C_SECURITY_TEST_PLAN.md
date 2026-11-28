# STAGE 04N.7C — PRE-EMULATOR SECURITY TEST PLAN

- **Audit Stage:** `04N.7C — Security Test Plan`
- **Target Workspace:** `/app/applet`
- **Firebase Project:** `palm-metric-app`
- **Firestore Database:** `(default)`
- **Candidate File:** `/app/applet/firestore.unified.candidate.rules`
- **SHA-256 Checksum:** `8bbe788edcd9b6d58d20fa0f8c949acc84ac50b0c116370bea1c2b23675b9aba` (Verified Match)
- **Date:** `2026-11-28`
- **Verdict:** **`PASS WITH LIMITATIONS`** *(Plan design complete and robust; execution blocked by JVM absence)*

---

## 1. Executive Summary

This test plan defines the comprehensive, reproducible security test suite for the unified Firestore Security Rules candidate (`firestore.unified.candidate.rules`). It establishes positive and negative test cases covering unauthenticated access, anonymous user restrictions, customer ownership isolation, verified admin privileges, transaction integrity, atomic cross-document invariants (`existsAfter`, `getAfter`), and anti-mutability constraints.

---

## 2. Test Objectives & Scope

- **Default-Deny Validation:** Verify unconfigured or unauthorized paths are strictly denied.
- **Role Isolation:** Confirm customers cannot access admin-only data or other customers' records.
- **Administrative Whitelist Enforcement:** Verify only confirmed UIDs (`jPgFPc8KbsXaPrdkyrbCQSFDMOP2`, `39H76y4E55g5yX2uY0lE5bQ3a393`) and email allowlist members can perform admin operations, while anonymous users are rejected.
- **Transactional Atomicity:** Verify order promotions correctly claim order numbers and link source requests.
