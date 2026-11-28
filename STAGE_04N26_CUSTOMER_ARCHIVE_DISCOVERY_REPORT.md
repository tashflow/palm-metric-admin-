# STAGE 04N.2.6 — Customer Archive Discovery Report

**Audit Stage:** Stage 04N.2.6 (Strictly Read-Only Investigation)  
**Target:** Palm Metric Customer App Only  
**Inspected Container Root (`/app/applet`) & Accessible Paths (`/app`, `/tmp`, `/workspace`, `/mnt`, `/root`):**

---

## 1. Critical Workspace Environment Finding

Inspection of `/app/applet` confirms that this container hosts the **Palm Metric Admin App** workspace (`metadata.json`: `"Verda Admin — Specialty Coffee & Food Management"`), **not** the live Palm Metric Customer App workspace (`Verdant — Specialty Coffee & Kitchen` / `tashflow/Palm-Metric`). No separate Customer workspace directory exists anywhere under `/app`, `/tmp`, `/workspace`, `/mnt`, or `/root`.

All Customer `.zip` archives discovered are stored as archive files inside `/app/applet/`.

---

## 2. Identity A vs Identity B Status

| Identity | Filename | Exact Path | Bytes | Files | SHA-256 | Stage 04N.2.6 Status |
|---|---|---|---:|---:|---|---|
| **Identity A** *(Expected)* | `palm-metric-stage04n24-customer.zip` | *Not present anywhere on disk* | `28,158,125` | `143` | `f98e56463fb29a00a78eb1b58dcc915dfa7394da65878fc93e6fc56b310dec88` | **`UNRESOLVED — SOURCE ARCHIVE NOT AVAILABLE`** |
| **Identity B** *(Present)* | `palm-metric-stage04n24-customer.zip` | `/app/applet/palm-metric-stage04n24-customer.zip` | `28,099,225` | `108` | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` | **PRESENT ON DISK** (`Identity B match`, source provenance: Stage 04N.2.4 Customer extract) |

---

## 3. Complete Inventory of Discovered Customer-Named & All Other `.zip` Archives

Search across `/app`, `/tmp`, `/workspace`, `/mnt`, `/root` located **17 `.zip` files** (all inside `/app/applet/`):

### A. Genuine Customer Source Archives (`src/components/CheckoutPage.tsx` present)
| Filename | Exact Path | Bytes | Files | SHA-256 | Modified (UTC) | Matches A or B? |
|---|---|---:|---:|---|---|---|
| `palm-metric-stage04n24-customer.zip` | `/app/applet/palm-metric-stage04n24-customer.zip` | `28,099,225` | `108` | `d01917c4c12146dd70d9c094e1efa9325d78fa7c4f6534438e31aba6f498f0a8` | `2026-11-27T16:06:23.074625+00:00` | **Identical to Identity B** |
| `palm-metric-stage04n22-customer.zip` | `/app/applet/palm-metric-stage04n22-customer.zip` | `28,065,764` | `107` | `14254ac4e37e95f8fe12c33c846c1c059181259c191f53ddc5bd750fd1ca1e61` | `2026-11-27T16:06:21.603495+00:00` | Neither (stale 04N.2.1 code minus `functions/package-lock.json`) |
| `palm-metric-stage04n21-customer.zip` | `/app/applet/palm-metric-stage04n21-customer.zip` | `28,096,952` | `108` | `e384f5db1b19829b6f2d19e8be3426d32b14cd95b556c98eb10edb0575313665` | `2026-11-27T16:06:19.967773+00:00` | Neither (Stage 04N.2.1 baseline) |
| `palm-metric-stage04n2-customer.zip` | `/app/applet/palm-metric-stage04n2-customer.zip` | `28,141,602` | `109` | `1ed5781e6526a1b29aa40c84d299b515f1b6d9a84050055feeb0e55cf98be351` | `2026-11-27T16:06:18.086179+00:00` | Neither (Stage 04N.2 archive) |

### B. Customer-Named Archives Containing Admin Tree (Historical Mislabeled Packages)
| Filename | Exact Path | Bytes | Files | SHA-256 | Modified (UTC) | Content Note |
|---|---|---:|---:|---|---|---|
| `palm-metric-stage04n1-customer.zip` | `/app/applet/palm-metric-stage04n1-customer.zip` | `1,869,874` | `87` | `f7c15c7643f3f956be837be436630964c77ef2acbdc6eb4cd78963a1e1e00188` | `2026-11-27T16:06:16.273197+00:00` | Contains Admin UI (`OrderRequestsView.tsx`), not Customer UI |
| `palm-metric-stage04n-customer.zip` | `/app/applet/palm-metric-stage04n-customer.zip` | `1,865,395` | `81` | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` | `2026-11-27T16:06:16.290046+00:00` | Byte-identical duplicate of `palm-metric-stage04n-admin.zip` |
| `palm-metric-stage04m2-customer.zip` | `/app/applet/palm-metric-stage04m2-customer.zip` | `1,856,291` | `73` | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` | `2026-11-27T16:06:16.322068+00:00` | Byte-identical duplicate of `palm-metric-stage04m2-admin.zip` |

*(No files were renamed, overwritten, moved, deleted, or reconstructed.)*
