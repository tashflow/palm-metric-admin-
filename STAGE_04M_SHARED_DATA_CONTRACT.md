# STAGE 04M — SHARED DATA CONTRACT

**Project:** Palm Metric (`palm-metric-app`)  
**Currency:** `SAR`  
**Date:** November 22, 2026  

---

## Overview

This shared data contract defines the precise schema, data types, validation rules, and responsible applications for the synchronization between the **Palm Metric Customer App** (`tashflow/Palm-Metric`) and the **Palm Metric Admin App** (`palm-metric-admin-`).

---

## 1. Customer Order Request (`/orderRequests/{requestId}`)

| Field Name | Data Type | Required/Optional | Responsible App | Trusted Source | Validation Rules / Constraints | Backward Compatibility |
|---|---|---|---|---|---|---|
| `requestReference` | string | Required | Customer App | Customer | Format `REQ-YYMMDD-XXXX`, length 5–32 chars. | Fallback to `REQ-{id}` if missing. |
| `customerUid` | string | Required | Customer App | Firebase Auth | Matches `request.auth.uid`, max 128 chars. | Required for Spark owner isolation. |
| `customerName` | string | Required | Customer App | Customer | Length 1–80 chars. | Defaults to 'Guest Customer'. |
| `customerContact` | string | Required | Customer App | Customer | Length 1–80 chars. | Defaults to '—'. |
| `pickupType` | string | Required | Customer App | System | Must be strictly `'pickup'`. | Pickup-only enforcement. |
| `pickupWindow` | string | Optional | Customer App | Customer | Max 80 chars. | Optional. |
| `items` | array | Required | Customer App | Customer | Array of 1–50 items with `itemId`/`productId`, `quantity` (1–50). | Supports legacy `productId` alias. |
| `notes` | string | Optional | Customer App | Customer | Max 300 chars. | Optional. |
| `status` | string | Required | Both | System / Admin | `'pending_review' \| 'under_review' \| 'verified' \| 'rejected' \| 'order_created'`. | Normalized on read. |
| `reviewStatus` | string | Required | Both | System / Admin | `'unreviewed' \| 'in_review' \| 'verified' \| 'needs_attention' \| 'approved' \| 'rejected'`. | Normalized on read. |
| `clientEstimatedTotal` | number | Optional | Customer App | Customer | Range 0–100,000 SAR. Untrusted estimate. | Optional. |
| `verifiedPricing` | map | Optional | Admin App | Admin Transaction | Contains `subtotalSar`, `discountSar`, `taxSar`, `totalSar`, `currency: 'SAR'`. | Optional. |
| `verifiedItems` | array | Optional | Admin App | Admin Transaction | Canonical verified items with stock verification and authoritative unit prices. | Optional. |
| `approvedOrderId` | string | Optional | Admin App | Admin Transaction | Deterministic format `ord_<requestId>`, max 128 chars. | Optional. |
| `approvedOrderNumber` | string | Optional | Admin App | Admin Transaction | Format `PM-xxxxxx`, max 32 chars. | Optional. |
| `rejectionReason` | string | Optional | Admin App | Admin | Length 1–300 chars, required when `status == 'rejected'`. | Optional. |
| `auditTrail` | array | Optional | Both | System / Admin | Array of audit snapshot objects (max 25). | Optional. |
| `createdAt` | timestamp | Required | Both | Server | Server timestamp. | Fallback to client time. |
| `updatedAt` | timestamp | Required | Both | Server | Server timestamp. | Fallback to client time. |

---

## 2. Official Order (`/orders/{orderId}`)

| Field Name | Data Type | Required/Optional | Responsible App | Trusted Source | Validation Rules / Constraints | Backward Compatibility |
|---|---|---|---|---|---|---|
| `orderNumber` | string | Required | Admin App | Admin Transaction | Format `PM-xxxxxx`, max 32 chars. | Fully compatible with legacy orders. |
| `customerUid` | string | Required | Admin App | Admin Transaction | Matches originating request `customerUid`. | Required. |
| `customerName` | string | Required | Admin App | Admin Transaction | Max 80 chars. | Required. |
| `customerContact` | string | Required | Admin App | Admin Transaction | Max 80 chars. | Required. |
| `items` | array | Required | Admin App | Admin Transaction | Verified canonical order line items with modifiers. | Compatible with legacy line items. |
| `subtotal` | number | Required | Admin App | Admin Transaction | Subtotal in SAR. | Fallback for legacy orders. |
| `totalBill` | number | Required | Admin App | Admin Transaction | Authoritative total bill in SAR. | Required. |
| `currency` | string | Required | Admin App | Admin Transaction | Strictly `'SAR'`. | Defaults to 'SAR'. |
| `orderType` | string | Required | Admin App | Admin Transaction | Strictly `'pickup'`. | Defaults to 'pickup'. |
| `paymentStatus` | string | Required | Admin App | Admin Transaction | `'pay_at_pickup' \| 'paid' \| 'pending'`. | Defaults to 'pay_at_pickup'. |
| `status` | string | Required | Both | Admin / System | `'Pending' \| 'Preparing' \| 'Ready' \| 'Completed' \| 'Cancelled'`. | Fully backward compatible. |
| `requestId` | string | Optional | Admin App | Admin Transaction | Originating request ID. | Optional for legacy orders. |
| `requestReference` | string | Optional | Admin App | Admin Transaction | Originating `REQ-...` reference. | Optional for legacy orders. |
| `approvedBy` | string | Optional | Admin App | Admin Transaction | Admin UID who promoted order. | Optional for legacy orders. |
| `pricingVersion` | integer | Optional | Admin App | Admin Transaction | Authoritative pricing version (v2). | Optional for legacy orders. |
| `createdAt` | timestamp | Required | Admin App | Server | Server timestamp. | Required. |
| `updatedAt` | timestamp | Required | Admin App | Server | Server timestamp. | Required. |

---

## 3. Audit Event (`/orderRequests/{requestId}/auditLogs/{logId}`)

- **Actions:** `'submitted' | 'start_review' | 'verify' | 'price_verified' | 'approve' | 'order_promoted' | 'reject'`
- **Immutability:** Append-only. Clients cannot update or delete audit logs. Customers cannot read audit logs.
- **Actor Roles:** `'admin' | 'customer' | 'system'`
