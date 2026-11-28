# STAGE 04N.2.7 — Admin Extraction Verification Report

**Audit Stage:** Stage 04N.2.7 (Strictly Read-Only Standalone Extraction)  
**Extraction Root:** `/tmp/stage04n27_extract/<tag>`

---

## 1. Extraction & Standalone Check Results Across All 13 Available Admin Archives

| Archive Filename | Extracted Files | Hash Mismatches | Diffs vs `/app/applet` *(excl. post-ZIP reports)* | `node_modules` / `package-lock` / `bun.lock` | Bare `tsc` / `vite` | Bare `stage04l.test.ts` | Bare `productCustomizations.test.ts` |
|---|---:|---:|---:|---|---|---|---|
| **Identity A** (`c00e9e4c...`, 64 files) | `0` | N/A | N/A | N/A | N/A | N/A | **`UNRESOLVED — SOURCE ARCHIVE NOT AVAILABLE`** |
| `palm-metric-stage04n24-admin.zip` (**Identity B**) | `112` / `112` | `0` | **`0` diffs** (`22` newer reports only in `/app/applet`) | `false` / `false` / `true` | `EXIT 1` *(npx missing `tsc`/`vite`)* | `EXIT 1` *(`ERR_MODULE_NOT_FOUND: firebase`)* | **PASS (`EXIT 0`, `10/10`)** |
| `palm-metric-stage04n22-admin.zip` | `98` / `98` | `0` | `9` diffs | `false` / `false` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n21-admin.zip` | `87` / `87` | `0` | `14` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n2-admin.zip` | `87` / `87` | `0` | `14` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n1-admin.zip` | `87` / `87` | `0` | `15` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n1-customer.zip` *(Admin)* | `87` / `87` | `0` | `15` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n-admin.zip` | `81` / `81` | `0` | `14` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04n-customer.zip` *(Admin)* | `81` / `81` | `0` | `14` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04m2-admin.zip` | `73` / `73` | `0` | `13` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04m2-customer.zip` *(Admin)* | `73` / `73` | `0` | `13` diffs (`+package-lock.json`) | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04m1-runnable.zip` | `65` / `65` | `0` | Superseded Stage 04M1 | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-stage04m-runnable.zip` | `61` / `61` | `0` | Superseded Stage 04M | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |
| `palm-metric-admin-stage04l.zip` | `55` / `55` | `0` | Superseded Stage 04L | `false` / `true` / `true` | `EXIT 1` | `EXIT 1` | Not re-run |

---

## 2. Key Extraction Observations

- All `13` Admin-content archives extracted with **`0` byte/SHA-256 corruptions**.
- `palm-metric-stage04n24-admin.zip` (`Identity B`) matches `/app/applet` `112/112` with `0` modified files; `/app/applet` itself compiles, lints, builds, and passes all `82` tests (`58` genuine + `24` stubs) using its own Admin `node_modules`.
- Because release ZIPs intentionally omit `node_modules`, isolated bare execution inside `/tmp/stage04n27_extract/stage04n24-admin` passes `src/lib/productCustomizations.test.ts` (`10/10`, pure Node + TS) while blocking `tsc`, `vite build`, and Firebase-dependent scripts (`ERR_MODULE_NOT_FOUND: Cannot find package 'firebase'`) unless dependencies are installed.
