# Palm Metric — Stage 04M.2 Changelog

## [0.4.2-stage04m2] — 2026-11-23

### Added
- Synchronized Admin App and Customer App with Stage 04M.2 unified data contracts.
- Enhanced authoritative pricing engine supporting integer halalas, discount/tax calculations, and price tampering detection.
- Managed numeric stock extraction (`stockQuantity` / `stockCount`) and atomic stock depletion plans.
- Read-only Admin Access Modal for secure allowlist management.
- Comprehensive automated test suite (`26/26 passed`).

### Fixed
- Corrected email typo in allowlist (`palmmatric1@gmail.com` -> `palmmetric1@gmail.com`).
- Added authorized admin email `tashfilartwork@gmail.com`.
- Resolved all TypeScript compilation warnings and errors (`tsc --noEmit` clean).

### Security
- Enforced zero-trust order request workflow where customer-submitted pricing is untrusted and verified server-side.
- Preserved pristine production `firestore.rules` while providing robust `firestore.spark.rules` for local validation.
