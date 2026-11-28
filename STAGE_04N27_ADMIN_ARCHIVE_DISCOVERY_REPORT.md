# STAGE 04N.2.7 — Admin Archive Discovery Report

**Audit Stage:** Stage 04N.2.7 (Strictly Read-Only Investigation)  
**Search Scope:** `/app`, `/tmp`, `/workspace`, `/mnt`, `/root` (all `17` `.zip` archives on disk sit in `/app/applet/`)

---

## 1. Identity A vs Identity B Investigation Results

| Identity | Filename | Exact Path | File Count | Bytes | SHA-256 | Stage 04N.2.7 Status |
|---|---|---|---:|---:|---|---|
| **Identity A** *(Expected)* | `palm-metric-stage04n24-admin.zip` | *Not present anywhere on disk* | `64` | `1,844,172` | `c00e9e4c4558d5f2b7841369289177484466fd2c3a13d62578fa33cc9fff143f` | **`UNRESOLVED — SOURCE ARCHIVE NOT AVAILABLE`** |
| **Identity B** *(Present)* | `palm-metric-stage04n24-admin.zip` | `/app/applet/palm-metric-stage04n24-admin.zip` | `112` | `1,927,570` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **PRESENT ON DISK** — `112/112` identical to `/app/applet` source/rules/tests/reports |

**Provenance Assessment:**
- Identity A (`64` files, `1,844,172` bytes, `c00e9e4c...`) was **not** recovered from any accessible directory or archive store in this container (`0` matches). Its file count (`64`) and size (`1,844,172` bytes) closely resemble earlier Stage 04M1-era Admin snapshots (`palm-metric-stage04m1-runnable.zip` has `65` files / `1,839,171` bytes), but without the actual archive bytes, its exact contents remain **UNRESOLVED**.
- Identity B (`palm-metric-stage04n24-admin.zip`, `112` files, `1,927,570` bytes, `be072ce3...`) is physically present and matches `/app/applet` **112 / 112 files byte-for-byte** (`0` content diffs; `/app/applet` additionally holds only the 22 post-ZIP `STAGE_04N24_*`, `STAGE_04N25_*`, and `STAGE_04N26_*` report files plus generated `package-lock.json` / `node_modules` / `dist`).

---

## 2. All Discovered Admin-Content Archives (13 Total)

| Filename | Exact Path | Files | Bytes | SHA-256 | Match vs A/B | Source / Content Notes |
|---|---|---:|---:|---|---|---|
| `palm-metric-stage04n24-admin.zip` | `/app/applet/palm-metric-stage04n24-admin.zip` | `112` | `1,927,570` | `be072ce3cb54bdf0cdef35225e242dae9009410432112b78c530f29d95f2bbe6` | **Identity B** | Current `/app/applet` Stage 04N.2.4 Admin package (`0` diffs) |
| `palm-metric-stage04n22-admin.zip` | `/app/applet/palm-metric-stage04n22-admin.zip` | `98` | `1,893,684` | `032688b3a8ee577a76bcc64ea20c0a94a79dd2251ec1196db112599aa941a9e4` | Neither | Superseded Stage 04N.2.2 Admin (`9` content diffs) |
| `palm-metric-stage04n21-admin.zip` | `/app/applet/palm-metric-stage04n21-admin.zip` | `87` | `1,870,040` | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` | Neither | Duplicate of `stage04n2-admin.zip` (superseded) |
| `palm-metric-stage04n2-admin.zip` | `/app/applet/palm-metric-stage04n2-admin.zip` | `87` | `1,870,040` | `e449dfcfbcf88ba0382e7faa726d06562752dd367438ad6ec2199902c5189efc` | Neither | Superseded Stage 04N.2 Admin |
| `palm-metric-stage04n1-admin.zip` | `/app/applet/palm-metric-stage04n1-admin.zip` | `87` | `1,869,885` | `ad5c6ed98f7b5156a85e7e00aad8adec8fc3e41809e0a487585513ab1188fbbd` | Neither | Superseded Stage 04N.1 Admin |
| `palm-metric-stage04n1-customer.zip` | `/app/applet/palm-metric-stage04n1-customer.zip` | `87` | `1,869,874` | `f7c15c7643f3f956be837be436630964c77ef2acbdc6eb4cd78963a1e1e00188` | Neither | Mislabeled Admin archive (superseded) |
| `palm-metric-stage04n-admin.zip` | `/app/applet/palm-metric-stage04n-admin.zip` | `81` | `1,865,395` | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` | Neither | Duplicate of `stage04n-customer.zip` (superseded) |
| `palm-metric-stage04n-customer.zip` | `/app/applet/palm-metric-stage04n-customer.zip` | `81` | `1,865,395` | `7cc317816928dc539a73571952a1351104108a3843eb51d9e82850898ae321b4` | Neither | Mislabeled duplicate Admin archive (superseded) |
| `palm-metric-stage04m2-admin.zip` | `/app/applet/palm-metric-stage04m2-admin.zip` | `73` | `1,856,291` | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` | Neither | Duplicate of `stage04m2-customer.zip` (superseded) |
| `palm-metric-stage04m2-customer.zip` | `/app/applet/palm-metric-stage04m2-customer.zip` | `73` | `1,856,291` | `3a3801a521bc4abb7477115910e931dc6d2f2c424c93b649a8544fd87ab07a0a` | Neither | Mislabeled duplicate Admin archive (superseded) |
| `palm-metric-stage04m1-runnable.zip` | `/app/applet/palm-metric-stage04m1-runnable.zip` | `65` | `1,839,171` | `b12db5159cae184db6b730ce5aacc44566a3f1e76bcbeb338c04c5715bce8e6d` | Neither | Superseded Stage 04M1 Admin |
| `palm-metric-stage04m-runnable.zip` | `/app/applet/palm-metric-stage04m-runnable.zip` | `61` | `1,834,970` | `66bfddbb654f3f32a53302bdcf4ab996a093f7e2ff78b7e1bf165b730ef8253d` | Neither | Superseded Stage 04M Admin |
| `palm-metric-admin-stage04l.zip` | `/app/applet/palm-metric-admin-stage04l.zip` | `55` | `1,823,063` | `de62b84fb2c26cf6303bee58e37393372e71964c706dfb5a6a44d6499e0e709b` | Neither | Superseded Stage 04L Admin |

*(The remaining 4 `.zip` files in `/app/applet` contain Customer App trees and were kept strictly separate.)*
