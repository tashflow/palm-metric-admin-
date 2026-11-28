# STAGE 04N.22 — SECURITY AND TRANSACTION REPORT

**Project:** Palm Metric (`palm-metric-app`)  
**Currency:** `SAR`  
**Date:** November 26, 2026  

---

## 1. Executive Summary

This report outlines the security invariants, transaction integrity rules, and zero-trust safeguards enforced across both applications and Firestore Spark security rules.

---

## 2. Security & Transaction Invariants

1. **Spark Free-Tier Architecture:** Maintained zero Cloud Functions dependency; security enforcement is handled natively via Firestore Security Rules (`firestore.spark.rules`) and client-side administrative transactions.
2. **Pricing Integrity:** All monetary calculations use integer halalas (`100 halalas = 1 SAR`) to prevent floating-point drift. Client price estimates are treated as untrusted hints.
3. **Inventory Atomicity:** All stock decrements occur within ACID Firestore transactions (`runTransaction`), preventing overselling or race conditions during concurrent admin approvals.
4. **Audit Trail Immutability:** Admin review actions and promotional events are logged into append-only subcollections (`/orderRequests/{requestId}/auditLogs`) where customer and unauthorized modifications are strictly denied.
5. **Order Number Uniqueness:** Official order numbers (`PM-XXXXXX`) are claimed through the `/orderNumbers/{orderNumber}` registry to prevent collision under high concurrency.
