# Palm Metric — Stage 04N Changelog

## [0.4.3-stage04n] — 2026-11-23

### Added
- Comprehensive Stage 04N test suite (`scripts/stage04n.test.ts`), bringing the total automated test count to **69 tests**.
- Full test coverage for customer security rules, admin allowlist, inventory concurrency, pricing validation, and legacy compatibility.
- Detailed markdown integration and verification reports (`STAGE_04N_*.md`).

### Fixed
- Reconciled the historical test count discrepancy between 26 and 69 tests.
- Fixed item option structure and mock store transaction context initialization in test suites.

### Security
- Validated Firestore security rules (`firestore.spark.rules`) against customer isolation, admin restrictions, and immutable collections.
