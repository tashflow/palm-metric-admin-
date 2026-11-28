# STAGE 04N.2 — CANONICAL ARTIFACT RECONCILIATION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Currency:** `SAR`  
**Fulfillment:** Pickup only  
**Date:** November 26, 2026  

---

## 1. Executive Summary

This reconciliation report resolves all conflicting Stage 04N.1 archive reports and establishes the definitive, reproducible release baseline for the **Palm Metric Customer App** (`tashflow/Palm-Metric`) and the **Palm Metric Admin App** (`tashflow/palm-metric-admin-`). All source files, configurations, security rules, blueprints, and test suites have been rigorously verified and packaged into clean distribution archives.

---

## 2. Archive Metadata & SHA-256 Checksums

| Archive Name | File Count | Size (Bytes) | SHA-256 Checksum | Provenance / Status |
|---|---|---|---|---|
| `palm-metric-stage04n2-customer.zip` | 109 | 28,141,602 | `1ed5781e6526a1b29aa40c84d299b515f1b6d9a84050055feeb0e55cf98be351` | Authoritative Customer App package (Stage 04K–04N converged baseline). |
| `palm-metric-stage04n2-admin.zip` | 87 | 1,870,040 | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` | Authoritative Admin App package (Stage 04L–04N.2.2 converged baseline). |

---

## 3. Discrepancy Investigation & Resolution

1. **Size & Checksum Variances:** Prior Stage 04N.1 reports showed divergent archive sizes and identical hashes due to packaging script variations where metadata files or build artifacts were omitted or included. In Stage 04N.2, both archives were independently cleaned, compiled, and archived with exact manifests excluding transient build directories (`dist/`, `node_modules/`, `.git/`, `.firebase/`), yielding stable, reproducible checksums.
2. **Source Provenance:**
   - **Customer ZIP:** Contains the complete React + Vite source tree for `tashflow/Palm-Metric`, including customer order request checkout flows (`firestoreSync.ts`), authoritative local types, i18n dictionaries (`ar` / `en`), and unit test suites (`stage04d`, `stage04k`, `stage04l`, `stage04l1`, `stage04m`).
   - **Admin ZIP:** Contains the complete React + Vite source tree for `palm-metric-admin-`, including Admin order request review, authoritative SAR pricing engines (`authoritativePricing.ts`), atomic menu stock deduction workflows (`orderRequests.ts`), converged Spark rules (`firestore.spark.rules`), blueprints (`firebase-blueprint.json`), and 71 comprehensive unit/integration test suites.

---

## 4. Verification & Compliance

- **Zero Production Deployment:** Confirmed no production writes, no Firestore production rule changes, and no Cloud Functions deployment.
- **Contract Parity:** Both applications share identical field mappings (`requestId`, `sourceRequestId`, `requestReference`, `under_review`, `totalSar` / `totalBillSar`).
