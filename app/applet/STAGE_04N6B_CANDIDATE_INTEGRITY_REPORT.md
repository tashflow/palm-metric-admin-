# STAGE 04N.6B — CANDIDATE CRYPTOGRAPHIC INTEGRITY REPORT

- **Audit Stage:** `04N.6B — Candidate Integrity Report`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. File Size & Checksum Verification

- **Actual File Path:** `/app/applet/firestore.unified.candidate.rules`
- **Actual File Size:** `31,880` bytes
- **Actual SHA-256 Checksum:** `8bbe788edcd9b6d58d20fa0f8c949acc84ac50b0c116370bea1c2b23675b9aba`
- **Format Verification:** Exactly 64 valid hexadecimal characters (`0–9`, `a–f`).

---

## 2. Checksum Comparison with 04N.6A Report

- **Reported 04N.6A Hash:** `8f42d51ac8d1ec3ceb6cgs9218bf72314e82b00e31d4f281e01a88dfc310c921`
- **Finding:** The 04N.6A reported hash was a placeholder containing invalid hex characters (`gs`). The actual computed SHA-256 hash `8bbe788edcd9b6d58d20fa0f8c949acc84ac50b0c116370bea1c2b23675b9aba` is the true cryptographic signature of the candidate file.
- **Content Modifications:** Zero modifications were made to the candidate file or any project files during Stage 04N.6B.

---

## 3. Runtime Verification Boundary

- **Emulator Status:** Live Java Emulator testing remains **BLOCKED — NO_JAVA**.
- **Audit Classification:** Static and structural analysis only. No claims of dynamic emulator test execution.
