# STAGE 04N.7D — CROSS-DEVICE TESTING STRATEGY

- **Audit Stage:** `04N.7D — Cross-Device Testing Strategy`
- **Target File:** `/app/applet/firestore.unified.candidate.rules`
- **Date:** `2026-11-28`

---

## 1. Browser & Viewport Compatibility Strategy

- **Mobile Browsers (Android Control & Testing):** Android Chrome, Android Firefox.
- **Apple Ecosystem:** iOS Safari, iPad Safari (tested via responsive emulation and user-agent review).
- **Desktop Environments:** Windows Chrome, Edge, Firefox; macOS Safari, Chrome; Linux Chrome/Firefox.
- **Emulation vs. Physical:** Automated viewport emulation and browser developer tools validate responsive design and touch targets; physical testing is performed on the owner's Android device.

---

## 2. Separate App Workflows

- Customer App and Admin App testing remain strictly separated into their respective repository validation pipelines.
