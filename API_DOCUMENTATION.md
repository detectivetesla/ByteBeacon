# ByteBeacon System API Documentation

**Authoritative Developer Reference & Complete Endpoint Specification**  
*Version: 2.1.0 | Updated: August 2026*

---

## 1. Overview & System Architecture

ByteBeacon is a multi-tier mobile data sourcing, reseller marketplace, and telecom API platform in Ghana supporting **MTN**, **Telecel**, and **AirtelTigo** data bundle fulfillment.

### Base URLs
* **Production API (Partner / Reseller V1):** `https://www.bytebeacon.online/api/v1`
* **Agent Storefront Public API:** `https://www.bytebeacon.online/api/agent-store`
* **Core Application / System API:** `https://www.bytebeacon.online/api`

---

## 2. Authentication & Authorization Matrix

The system implements strict Role-Based Access Control (RBAC) across four user roles: `customer`, `agent`, `superagent`, and `admin`.

| Role | Role Scope & Capabilities | API Key Access (`/api/users/api-keys`) | Partner API Access (`/api/v1`) | Agent Storefront Management |
| :--- | :--- | :---: | :---: | :---: |
| `customer` | Standard retail buyer. Can buy data bundles via UI. | ❌ No | ❌ No | ❌ No |
| `agent` | Operates an Agent Storefront, customizes selling prices, withdraws sales profit to MoMo. | ❌ No | ❌ No | ✅ Yes |
| `superagent` | Enterprise developer/partner. Integrates directly via REST API endpoints & API keys. | ✅ Yes (`dk_...`) | ✅ Yes | ✅ Yes |
| `admin` | Platform administrator with full access. | ✅ Yes | ✅ Yes | ✅ Yes |

### Authentication Schemes

#### 1. Bearer JWT Authentication (Dashboard & Internal API)
Used by web applications and dashboards.
```http
Authorization: Bearer <JWT_TOKEN>
```

#### 2. Partner API Key Authentication (`x-api-key` / `Authorization`)
Used by Super Agents, Partners, and SMM Panels on `/api/v1` endpoints.
```http
X-API-Key: dk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```
*or*
```http
Authorization: Bearer dk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3. Mandatory HMAC Payload Signing (Write Endpoints for Partner Accounts)
For state-mutating requests (e.g., `POST /api/v1/data/purchase`) on partner accounts with encrypted API secrets:

| Header Name | Format / Description |
| :--- | :--- |
| `X-API-Key` | Partner API key (`dk_live_...` or `ak_live_...`) |
| `X-ByteBeacon-Timestamp` | Unix epoch timestamp in seconds. Rejects if clock skew > 5 minutes (300s). |
| `X-ByteBeacon-Nonce` | Unique random string per request to prevent replay attacks. Reuses trigger HTTP 400. |
| `X-ByteBeacon-Signature` | Hex-encoded HMAC-SHA256 hash computed on `req.rawBody` using the partner's API Secret. |

##### HMAC Signature Verification Logic (Node.js Example)
```javascript
const crypto = require('crypto');

const apiKey = "dk_live_9a3e6f2d4c8b1a0e9f8d7c6b";
const apiSecret = "sec_0f9e8d7c6b5a4f3e2d1c0b";
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomBytes(8).toString('hex');

const payload = {
  reference: "tx_unique_ref_9928172",
  network: "MTN",
  phone: "0551234567",
  plan_id: "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
};

const payloadStr = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(payloadStr)
  .digest('hex');
```

---

## 3. Partner Reseller API (v1)

### 3.1 Fetch Data Bundle Plans
* **HTTP Method:** `GET`
* **Path:** `/api/v1/plans`
* **Auth:** Required (`X-API-Key` or `Bearer <key>`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "plans": [
    {
      "id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e",
      "network": "MTN",
      "name": "1.5GB",
      "price": 5.00
    },
    {
      "id": "b2f1c8a4-9d3e-4f5a-6b7c-8d9e0f1a2b3c",
      "network": "TELECEL",
      "name": "5GB",
      "price": 23.50
    }
  ]
}
```

---

### 3.2 Purchase Data Bundle
* **HTTP Method:** `POST`
* **Path:** `/api/v1/data/purchase`
* **Auth:** Required (`X-API-Key` + HMAC Signature Headers for Partner Accounts)

#### Request Body
```json
{
  "reference": "your_unique_txn_ref_99812",
  "network": "MTN",
  "phone": "0551234567",
  "plan_id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
}
```

#### Parameter Mappings Supported (SMM Panel Compatibility)
* `phone` | `recipient_phone` | `phone_number` | `number` | `link` | `recipient`
* `plan_id` | `bundle_id` | `plan` | `service` | `offer_id`
* `reference` | `client_reference` | `ref`

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "processing"
}
```

---

### 3.3 Check Order Status
* **HTTP Method:** `GET`
* **Path:** `/api/v1/transactions/:id`
* **Auth:** Required (`X-API-Key`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "completed",
  "network": "MTN",
  "recipient_phone": "233551234567",
  "amount": 5.00,
  "created_at": "2026-08-12T04:00:00.000Z"
}
```

---

### 3.4 List Partner Transactions
* **HTTP Method:** `GET`
* **Path:** `/api/v1/transactions?limit=50&offset=0`
* **Auth:** Required (`X-API-Key`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "transactions": [
    {
      "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
      "status": "completed",
      "network": "MTN",
      "recipient_phone": "233551234567",
      "amount": 5.00,
      "created_at": "2026-08-12T04:00:00.000Z"
    }
  ]
}
```

---

### 3.5 Check Prepaid Wallet Balance
* **HTTP Method:** `GET`
* **Path:** `/api/v1/wallet`
* **Auth:** Required (`X-API-Key`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "balance": 450.75
}
```

---

### 3.6 Check Credit Line Status
* **HTTP Method:** `GET`
* **Path:** `/api/v1/credit`
* **Auth:** Required (`X-API-Key`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "credit_limit": 1000.00,
  "outstanding_balance": 250.00,
  "available_credit": 750.00
}
```

---

## 4. Pending MTN Approval Workflow

When an order contains an MTN recipient phone number that is not yet validated by MTN, the system triggers the **Pending MTN Approval** workflow:

```
Order Received (MTN)
       │
       ▼
Precheck / Sourcing Response (BENEFICIARY_NOT_VALIDATED / known: false)
       │
       ▼
Status set to "pending_mtn_approval" (Number recorded in mtn_beneficiary_approvals)
       │
       ▼
Order held safely (No premature failure or double billing)
       │
       ▼
Background Sync Job (statusSync.js PASS 4 runs every 20s)
       │
       ├──► Approved by MTN ──► Resubmit with original Idempotency Key ──► Status: completed
       └──► Rejected by MTN ──► Update Linked Orders ──────────────────► Status: rejected
```

### Admin Pending MTN Approval Endpoints (Auth + Admin)
* `GET /api/admin/mtn-approvals` – List paginated approval records (`status`, `timeframe`, `search`, `limit`, `offset`).
* `GET /api/admin/mtn-approvals/count` – Live badge count of pending/submitted items.
* `GET /api/admin/mtn-approvals/export` – Export filtered records as CSV file.
* `GET /api/admin/mtn-approvals/:id/orders` – View linked order history for a beneficiary.
* `POST /api/admin/mtn-approvals/sync` – Manually trigger status sync with MTN/DataHouse.

---

## 5. Agent Storefront API

### Public Storefront Endpoints (No Auth)
* `GET /api/agent-store/public/store/:slug` – Get store details, custom selling prices, branding colors, store active status.
* `POST /api/agent-store/public/store/:slug/buy/initialize` – Initialize customer Paystack checkout.
* `POST /api/agent-store/public/store/buy/verify` – Verify Paystack transaction reference and trigger bundle delivery.
* `GET /api/agent-store/public/track/:orderId` – Live track order status (`processing`, `completed`, `pending_mtn_approval`, `failed`).

### Agent Authenticated Management Endpoints (`auth` + `agentOrAdmin`)
* `POST /api/agent-store/create` – Create agent storefront.
* `GET /api/agent-store/my-store` – Fetch agent store profile.
* `PUT /api/agent-store/settings` – Update store name, slug, logo, contact, colors.
* `POST /api/agent-store/activate/initialize` – Initialize GHS 100 store activation fee.
* `POST /api/agent-store/activate/verify` – Verify store activation.
* `GET /api/agent-store/products` – Get bundle catalog with agent profit margins.
* `POST /api/agent-store/products/add` – Add bundle to store catalog.
* `POST /api/agent-store/products/update` – Update custom selling price (Must be positive `> 0`).
* `DELETE /api/agent-store/products/:bundleId` – Remove product from store catalog.
* `GET /api/agent-store/dashboard` – Get store metrics (sales volume, total profit, order count).
* `GET /api/agent-store/orders` – Get storefront customer order history.
* `GET /api/agent-store/customers` – Get unique store customer list.
* `POST /api/agent-store/withdrawals` – Request profit payout to Mobile Money wallet.
* `GET /api/agent-store/withdrawals` – Get withdrawal payout history.

---

## 6. Developer API Key Management (SuperAgent & Admin Only)

Super Agents and Admins can create and manage developer API keys via the following endpoints:

* `GET /api/users/api-key` (`auth` + `superAgentOrAdmin`) – Get active primary API key.
* `POST /api/users/api-key/regenerate` (`auth` + `superAgentOrAdmin`) – Regenerate primary API key.
* `GET /api/users/api-keys` (`auth` + `superAgentOrAdmin`) – List all named API keys.
* `POST /api/users/api-keys` (`auth` + `superAgentOrAdmin`) – Create named API key (`dk_...`).
* `DELETE /api/users/api-keys/:id` (`auth` + `superAgentOrAdmin`) – Revoke or permanently delete API key.

---

## 7. Webhooks Specifications & Security

ByteBeacon dispatches asynchronous HTTP POST webhooks when transaction statuses change.

### Webhook Security & SSRF Whitelisting
1. **SSRF Defense:** Webhook target URLs are resolved via DNS. Destinations resolving to loopback (`127.0.0.1`), private subnets (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`), or AWS metadata IP (`169.254.169.254`) are strictly blocked.
2. **HMAC Signature:** Webhook requests include header `X-ByteBeacon-Signature` calculated as `HMAC-SHA256(raw_json_body, partner_api_secret)`.
3. **Retry Exponential Backoff:** Failed webhooks are retried up to 5 attempts at intervals of 0, 1m, 5m, 15m, and 60m.

#### Webhook Payload Example
```json
{
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "completed",
  "reference": "your_unique_txn_ref_99812",
  "network": "MTN",
  "phone": "233551234567",
  "amount": 5.00
}
```

---

## 8. Rate Limiting & Security Policies

* **Global Rate Limit:** 100 requests per 15 minutes (`globalLimiter`).
* **Auth Rate Limit:** 10 requests per 15 minutes (`authLimiter`).
* **Payment Rate Limit:** 30 requests per 15 minutes (`paymentLimiter`).
* **Withdrawal Rate Limit:** 5 withdrawal requests per hour (`withdrawalLimiter`).
* **Partner API Limits:** Configurable per partner (Default: 60 RPM, 1,000 RPH, 10,000 RPD). Exceeding limits returns HTTP `429 Too Many Requests`.

---

## 9. Error Code Reference

| HTTP Status | Error Code | Description / Cause | Action |
| :--- | :--- | :--- | :--- |
| `400` | `Bad Request` | Missing required parameters (`network`, `phone`, `plan_id`), invalid UUID format, or network mismatch. | Check request body parameters and ensure `plan_id` is a valid UUID. |
| `401` | `Unauthorized` | Invalid or missing `X-API-Key`, or failed HMAC signature calculation. | Verify API key and HMAC signature calculation. |
| `403` | `Forbidden` | User role lacks permission, account suspended, or client IP not whitelisted. | Verify user role (`superagent` required for developer API keys) or IP whitelist settings. |
| `404` | `Not Found` | Requested plan ID, transaction ID, or agent store does not exist. | Verify bundle ID or transaction ID. |
| `400` | `Insufficient Funds` | Prepaid wallet balance insufficient and credit overdraft limit exceeded. | Topup wallet balance or request credit limit increase. |
| `429` | `Too Many Requests` | Rate limit exceeded (RPM, RPH, RPD, or payment limiter). | Implement backoff and reduce request concurrency. |
| `500` | `Internal Server Error` | Backend system error. Order state remains safe without double billing. | Contact support or retry request. |
