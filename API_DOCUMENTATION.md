# ByteBeacon System & Partner API Documentation

**Authoritative Developer Reference & Complete Endpoint Specification**  
*Version: 3.0.0 | Updated: August 2026*

---

## 1. Overview & System Architecture

ByteBeacon is an enterprise multi-tier mobile data sourcing platform, reseller marketplace, and telecom API gateway in Ghana supporting **MTN**, **Telecel**, and **AirtelTigo** data bundle fulfillment.

The platform handles high-volume single and bulk data bundle delivery, automated MTN beneficiary pre-validation, real-time two-way order status synchronization with DataHouse and Portal-02, and agent storefront management.

### Base URLs
* **Partner / Super Agent Reseller API (V1):** `https://www.bytebeacon.online/api/v1`
* **High-Capacity Bulk Order API:** `https://www.bytebeacon.online/api/bulk-orders` *(also mapped to `/api/v1/orders/bulk`)*
* **Agent Storefront Public API:** `https://www.bytebeacon.online/api/agent-store`
* **Core / System Public API:** `https://www.bytebeacon.online/api`

---

## 2. Base URL & Environment Configuration

| Environment | Base URL | API Key Prefix | Target Fulfillment |
| :--- | :--- | :--- | :--- |
| **Production (Live)** | `https://www.bytebeacon.online/api` | `ak_live_...` or `dk_live_...` | Real telecom providers (DataHouse / Portal-02) & real wallet balance. |
| **Sandbox (Test Mode)** | `https://www.bytebeacon.online/api` | `ak_test_...` or `dk_test_...` | Simulated fulfillment, no real wallet deduction, mock MTN approvals. |

---

## 3. Authentication & Security

### 3.1 Authentication Headers

API requests to Partner and Bulk endpoints require authentication using the `x-api-key` header or a standard Bearer token.

```http
x-api-key: ak_live_xxxxxxxxxxxxxxxxxxxxxxxx
```
*or*
```http
Authorization: Bearer ak_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **CRITICAL SECURITY WARNING:** API keys grant full access to your wallet balance and ordering capabilities. API keys must **NEVER** be exposed in client-side code (browser JavaScript, mobile app bundles, or public repositories). Always execute API calls from secure server-side environments.

---

### 3.2 Mandatory HMAC Request Signing (Partner Accounts)

State-mutating write requests (`POST`, `PUT`, `DELETE`, `PATCH`) for partner accounts configured with an API Secret must include HMAC-SHA256 headers to prevent request tampering and replay attacks.

| Header Name | Type | Description |
| :--- | :--- | :--- |
| `x-api-key` | String | Active API key (`ak_live_...` / `dk_live_...`). |
| `x-bytebeacon-timestamp` | Integer | Unix epoch timestamp in seconds. Requests with clock skew > 5 minutes (300s) are rejected. |
| `x-bytebeacon-nonce` | String | Unique random string per request. Duplicate nonces trigger `HTTP 400 Bad Request`. |
| `x-bytebeacon-signature` | String | Hex-encoded HMAC-SHA256 signature calculated over the raw JSON body using your API secret. |

#### Signature Calculation Logic (Node.js Example)
```javascript
const crypto = require('crypto');

const apiSecret = "sec_0f9e8d7c6b5a4f3e2d1c0b";
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomBytes(16).toString('hex');
const payloadStr = JSON.stringify({
  network: "MTN",
  phone: "0241234567",
  plan_id: "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
});

const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(payloadStr)
  .digest('hex');
```

---

## 4. Agent Tiers & API Access Control

ByteBeacon strictly enforces Role-Based Access Control (RBAC) across four distinct roles:

```
                      ┌─────────────────────────────────────────┐
                      │                admin                    │
                      │  (Full system & MTN approval control)   │
                      └────────────────────┬────────────────────┘
                                           │
                      ┌────────────────────┴────────────────────┐
                      │               superagent                │
                      │  (Enterprise API Keys, Bulk, Webhooks) │
                      └────────────────────┬────────────────────┘
                                           │
                      ┌────────────────────┴────────────────────┐
                      │                 agent                   │
                      │  (Agent Storefront UI, Custom Prices)   │
                      └────────────────────┬────────────────────┘
                                           │
                      ┌────────────────────┴────────────────────┐
                      │                customer                 │
                      │    (Retail buyer on Storefront UI)      │
                      └─────────────────────────────────────────┘
```

### Role Capabilities & Access Matrix

| Capabilities & Endpoints | Customer (`customer`) | Agent (`agent`) | Super Agent (`superagent`) | Administrator (`admin`) |
| :--- | :---: | :---: | :---: | :---: |
| Storefront UI & Retail Purchases | ✅ | ✅ | ✅ | ✅ |
| Storefront Custom Pricing & MoMo Payouts | ❌ | ✅ | ✅ | ✅ |
| API Key Management (`/api/users/api-keys`) | ❌ | ❌ | ✅ | ✅ |
| Single Partner API (`/api/v1/data/purchase`) | ❌ | ❌ | ✅ | ✅ |
| High-Capacity Bulk API (`/api/bulk-orders`) | ❌ | ❌ | ✅ | ✅ |
| Beneficiary Precheck API (`/api/system/...`) | ❌ | ❌ | ✅ | ✅ |
| Webhook Configuration & Logs | ❌ | ❌ | ✅ | ✅ |
| MTN Approval Admin Control (`/api/admin/...`)| ❌ | ❌ | ❌ | ✅ |

> 🚫 **Agent vs. Super Agent Access Note:** Normal `agent` accounts represent Storefront resellers who manage custom storefront prices via web dashboards. They do **not** possess developer API access. If a standard `agent` account attempts to access API key or developer endpoints, the API returns:
> ```json
> {
>   "success": false,
>   "error": "Forbidden",
>   "message": "SuperAgent or Admin access required. Normal agents do not have access to developer API features."
> }
> ```

---

## 5. API Keys & Key Management

Developer API keys are managed by Super Agents and Administrators.

### API Key Endpoints (`auth` + `superAgentOrAdmin`)
* `GET /api/users/api-key` — Retrieve active primary API key.
* `POST /api/users/api-key/regenerate` — Regenerate primary API key.
* `GET /api/users/api-keys` — List all named API keys.
* `POST /api/users/api-keys` — Create a new named API key (`ak_live_...` or `ak_test_...`).
* `DELETE /api/users/api-keys/:id` — Revoke/delete an API key.

---

## 6. Scopes & Permissions

API keys can be restricted using granular permission scopes or issued as full-access keys.

| Scope | Name | Description |
| :--- | :--- | :--- |
| `orders:read` | Read Orders | Query single order status, order history, and batch progress. |
| `orders:write` | Place Orders | Submit single data bundle purchase orders. |
| `bulk:write` | Bulk Orders | Ingest high-capacity bulk order batches (up to 10,000 recipients). |
| `wallet:read` | Read Wallet | View wallet balance, credit limits, and financial ledger. |
| `bundles:read` | Read Catalog | Query available data bundle plans, networks, and prices. |
| `beneficiaries:read`| Beneficiary Precheck | Perform MTN beneficiary prechecks and query approval statuses. |
| `webhooks:read` | Read Webhooks | View registered webhook endpoints and delivery logs. |
| `webhooks:write` | Manage Webhooks | Register, update, and delete webhook destinations. |

---

## 7. Rate Limits & Throttling

ByteBeacon enforces rate limiting at both global and partner levels using a sliding window algorithm:

* **Partner API Limits (Default):**
  * **RPM (Requests Per Minute):** 60 - 100 requests / min.
  * **RPH (Requests Per Hour):** 1,000 requests / hr.
  * **RPD (Requests Per Day):** 10,000 requests / day.
* **Global Endpoint Limits:** 100 requests per 15 minutes.

Exceeding rate limits returns `HTTP 429 Too Many Requests`:
```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded (RPM). Please implement exponential backoff."
}
```

---

## 8. Response & Error Formats

### 8.1 Standard Success Format (`HTTP 200 / 201 / 202`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

### 8.2 Standard Error Format (`HTTP 400 / 401 / 403 / 404 / 422 / 429 / 500`)
```json
{
  "success": false,
  "error": "Validation Error",
  "code": "BENEFICIARY_NOT_VALIDATED",
  "message": "This MTN number has not yet been approved by MTN. It has been recorded for MTN approval.",
  "data": {
    "phoneNumber": "0594506310",
    "network": "MTN",
    "status": "pending",
    "pendingApproval": true
  }
}
```

---

## 9. Agent Profile API

### 9.1 Fetch User Profile
* **Method:** `GET`
* **Path:** `/api/users/profile`
* **Auth:** Required (Bearer JWT or API Key)

#### Response (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "39d80570-a06d-49c3-a922-b3522029d645",
    "email": "partner@example.com",
    "name": "Enterprise Reseller Ltd",
    "role": "superagent",
    "wallet_balance": 1450.50
  }
}
```

---

## 10. Data Bundles & Catalog API

### 10.1 Fetch Available Plans
* **Method:** `GET`
* **Path:** `/api/v1/plans`
* **Auth:** Required (`x-api-key`)

#### Response (`200 OK`)
```json
{
  "success": true,
  "plans": [
    {
      "id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e",
      "network": "MTN",
      "name": "1GB",
      "price": 4.50
    },
    {
      "id": "b2f1c8a4-9d3e-4f5a-6b7c-8d9e0f1a2b3c",
      "network": "TELECEL",
      "name": "5GB",
      "price": 22.00
    }
  ]
}
```

---

## 11. Beneficiary / MTN Validation Architecture — IMPORTANT

To comply with Ghanaian telecom regulations and prevent order failures, **unverified MTN beneficiary numbers MUST NOT enter the normal order fulfillment workflow.**

### 11.1 The Pre-Validation Workflow

```
                        API Request / Order Attempt
                                     │
                                     ▼
                        MTN Beneficiary Precheck
                                     │
                        ┌────────────┴────────────┐
                        │                         │
                     validated                 unverified
                    (known=true)              (known=false)
                        │                         │
                        ▼                         ▼
               Create Normal Order       Record in Pending MTN
               & Debit Wallet            Approvals System (DB)
                        │                         │
                        ▼                         ▼
                Order Fulfillment       HTTP 422 Unprocessable
                (DataHouse/Portal-02)   (ZERO Debit, ZERO Order)
```

### 11.2 Strict State Isolation Rules for Unverified MTN Numbers

When an unverified MTN recipient is submitted:
1. ❌ **NOT** created as a normal order in `transactions`.
2. ❌ **NOT** set to `processing`.
3. ❌ **NOT** set to `failed` or `rejected`.
4. ❌ **NOT** debited from your wallet balance.
5. ❌ **NOT** subject to automated order refunds.
6. ❌ **NOT** included in normal order revenue or sales history.

Instead, the recipient is recorded in `mtn_beneficiary_approvals` with status `pending`. Once MTN approves the number, its status becomes `approved` (`known=true`), allowing subsequent order attempts to fulfill normally.

---

## 12. Public & Authenticated MTN Prechecks

### 12.1 Public MTN Precheck (`POST /api/system/beneficiary-precheck`)
Prechecks one or more phone numbers without requiring an API key.

#### Request Body
```json
{
  "network": "MTN",
  "phoneNumbers": ["0594506310", "0241234567"]
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "results": [
    {
      "phone": "0594506310",
      "valid": true,
      "known": false,
      "enforced": true,
      "reason": "Number is valid format but requires MTN beneficiary approval before data delivery."
    },
    {
      "phone": "0241234567",
      "valid": true,
      "known": true,
      "enforced": true,
      "reason": "Beneficiary validated and ready for instant delivery."
    }
  ]
}
```

> 💡 **Field Definitions:**
> * `valid: true` — The phone number possesses valid Ghanaian MSISDN format.
> * `known: true` — The number has been previously verified/approved by MTN.
> * `known: false` — The number requires MTN beneficiary approval. **This does NOT mean the number is malformed.**

---

### 12.2 Authenticated MTN Precheck & Recording (`POST /api/system/beneficiary-precheck`)
Allows authenticated API clients to perform format checking and optionally record unknown numbers directly into the Pending MTN Approvals queue.

#### Request Body
```json
{
  "network": "MTN",
  "phoneNumbers": ["0594506310"],
  "record": true,
  "bundleSize": "1GB",
  "source": "API Precheck"
}
```

* `record: false` — Evaluates validation status only; does **not** create pending approval database records.
* `record: true` — Evaluates validation status **and** records unknown MTN beneficiaries into the Pending MTN Approval queue.

---

## 13. Pending MTN Approvals API

Query beneficiary approval statuses recorded in the platform database.

### 13.1 Fetch Beneficiary Approvals (`GET /api/agent-store/beneficiaries`)
* **Auth:** Required (`x-api-key` or Bearer token)
* **Query Parameters:** `status` (`pending`|`submitted`|`approved`|`rejected`), `network`, `search`, `page`, `limit`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "9b8a7f6e-5d4c-3b2a-1f0e-9d8c7b6a5f4e",
      "phone": "0594506310",
      "network": "MTN",
      "bundleSize": "1GB",
      "occurrenceCount": 3,
      "status": "pending",
      "firstDetected": "2026-08-12T02:07:00Z",
      "lastDetected": "2026-08-12T02:09:00Z"
    }
  ]
}
```

---

## 14. Single Orders API

Submit a single data bundle purchase order.

### 14.1 Place Data Order (`POST /api/v1/data/purchase`)
* **Method:** `POST`
* **Path:** `/api/v1/data/purchase`
* **Auth:** Required (`x-api-key` + HMAC headers if secret configured)

#### Request Body
```json
{
  "reference": "tx_unique_ref_99812",
  "network": "MTN",
  "phone": "0241234567",
  "plan_id": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
}
```

#### Parameter Aliases Supported (SMM Panel Compatibility)
* Phone: `phone`, `recipient_phone`, `phone_number`, `number`, `link`, `recipient`
* Plan: `plan_id`, `bundle_id`, `plan`, `service`, `offer_id`
* Reference: `reference`, `client_reference`, `ref`

#### Success Response — Verified Beneficiary (`201 Created`)
```json
{
  "success": true,
  "transaction_id": "7f9c8d6e-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "status": "processing"
}
```

#### Error Response — Unverified MTN Beneficiary (`422 Unprocessable Entity`)
```json
{
  "success": false,
  "code": "BENEFICIARY_NOT_VALIDATED",
  "message": "This MTN number has not yet been approved by MTN. It has been recorded for MTN approval. You will be able to place the order once the number is approved.",
  "data": {
    "phoneNumber": "0594506310",
    "network": "MTN",
    "status": "pending",
    "pendingApproval": true
  }
}
```
*Notice: Wallet balance is NOT debited when HTTP 422 is returned.*

---

## 15. High-Capacity Bulk Orders API

Submit large bulk orders (from 1 to 10,000 recipients per request) asynchronously.

### 15.1 Ingest Bulk Batch (`POST /api/bulk-orders` or `POST /api/v1/orders/bulk`)
* **Method:** `POST`
* **Auth:** Required (`x-api-key`)

#### Request Body
```json
{
  "network": "MTN",
  "dataAmount": "1GB",
  "bundleId": "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e",
  "recipients": [
    "0241234567",
    "0551234567",
    "0594506310"
  ],
  "onUnvalidated": "set_aside",
  "source": "API Bulk Engine"
}
```

#### Instant Response (`202 Accepted`)
```json
{
  "success": true,
  "statusCode": 202,
  "message": "Bulk order accepted for processing",
  "data": {
    "submissionId": "8a7f6e5d-4c3b-2a1f-0e9d-8c7b6a5f4e3d",
    "publicId": "bulk_9920148",
    "referenceCode": "BLK-1786543097132-5762",
    "status": "queued",
    "totalRecipients": 3,
    "queuedRecipients": 3,
    "chunkSize": 100
  }
}
```

---

### 15.2 Bulk Unvalidated Beneficiary Modes

| Mode (`onUnvalidated`) | Behaviour for Validated Recipients | Behaviour for Unverified MTN Recipients | Overall Submission Status |
| :--- | :--- | :--- | :--- |
| `"set_aside"` *(Default)* | Fulfills normally. Wallet debited for validated items only. | Recorded in `mtn_beneficiary_approvals` in `pending_mtn_approval` state. **Not debited.** | `completed` or `completed_with_errors` |
| `"reject"` | Submission aborted. No orders placed. | No orders placed. | `rejected` (`HTTP 422`) |

---

### 15.3 Bulk Submission vs Child Order Identifiers

> ⚡ **CRITICAL IDENTIFIER DISTINCTION:**
> * **Submission ID (`submissionId`)**: Represents the entire bulk batch header (e.g. `8a7f6e5d-...`). Use with `/api/bulk-orders/:submissionId`.
> * **Transaction ID (`transaction_id`)**: Represents an individual recipient's child order item. Use with `/api/v1/transactions/:id`.
> * Do **NOT** pass a `submissionId` to `/api/v1/transactions/:id`.

---

### 15.4 Fetch Bulk Submission Progress (`GET /api/bulk-orders/:id`)
* **Path:** `/api/bulk-orders/:submissionId`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "8a7f6e5d-4c3b-2a1f-0e9d-8c7b6a5f4e3d",
    "referenceCode": "BLK-1786543097132-5762",
    "network": "MTN",
    "dataAmount": "1GB",
    "status": "processing",
    "totalRecipients": 2000,
    "queued": 500,
    "processing": 100,
    "completed": 1350,
    "failed": 20,
    "blocked": 10,
    "pendingMtn": 20,
    "unresolved": 0,
    "progressPercent": 70
  }
}
```

---

### 15.5 Fetch Server-Side Paginated Items (`GET /api/bulk-orders/:id/items`)
* **Path:** `/api/bulk-orders/:submissionId/items?page=1&limit=50&status=all`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "item_110293",
      "item_index": 0,
      "recipient_phone": "0241234567",
      "status": "completed",
      "datahouse_reference": "DH-881920",
      "attempt_count": 1
    },
    {
      "id": "item_110294",
      "item_index": 1,
      "recipient_phone": "0594506310",
      "status": "pending_mtn_approval",
      "error_message": "Queued for MTN Approval",
      "attempt_count": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalItems": 2000,
    "totalPages": 40
  }
}
```

---

## 16. Order Statuses & Lifecycle

### 16.1 Order Status State Machine Table

| Status | Category | Meaning | Is Terminal State? |
| :--- | :--- | :--- | :---: |
| `received` | Initial | Order accepted and queued into system. | ❌ No |
| `processing` | In-Flight | Order transmitted to telecom provider (DataHouse/Portal-02). | ❌ No |
| `completed` / `fulfilled` | Success | Data bundle successfully delivered to recipient phone. | ✅ **YES** |
| `failed` / `rejected` | Failure | Order rejected by provider (e.g. invalid subscriber line). | ✅ **YES** |
| `partially_approved` | Partial | Partial data volume delivered. | ✅ **YES** |
| `refunded` | Financial | Charged funds refunded to API wallet following failure. | ✅ **YES** |

---

### 16.2 Beneficiary State Machine vs. Order State Machine

```
   BENEFICIARY APPROVAL LIFECYCLE (Phone Level)
   pending ──► submitted ──► ┌──► approved (known=true, Orderable)
                             └──► rejected (Outside Normal Orders)

   ORDER FULFILLMENT LIFECYCLE (Transaction Level)
   received ──► processing ──► ┌──► completed / fulfilled (Delivered)
                              └──► failed / rejected ──► refunded
```

---

## 17. Two-Way Order Synchronization with DataHouse

ByteBeacon implements real-time order status synchronization with DataHouse and Portal-02.

### 17.1 Synchronization Flow

```
   ByteBeacon                      DataHouse / Portal-02
       │                                     │
       ├────── POST Order (API) ────────────►│
       │                                     │ (Fulfills order)
       │◄───── HTTP Webhook Event ───────────┤
       │  (or Status Sync Cron Polling)      │
       │                                     │
  Update Order Status
  (Guard: Block Terminal Regressions)
```

### 17.2 Upstream DataHouse Status Mapping Rules

| DataHouse Upstream Event | ByteBeacon Order Status | Financial Action |
| :--- | :--- | :--- |
| `approved` / `delivered` / `fulfilled` | `completed` | Retained as paid; profit recorded. |
| `partially_approved` | `partially_approved` | Partial fulfillment recorded. |
| `rejected` / `blocked` / `invalid` | `failed` / `rejected` | **Automated full wallet refund.** |
| `failed` / `error` | `failed` | **Automated full wallet refund.** |

---

## 18. Wallet, Ledger & Refunds

### 18.1 Wallet Balance (`GET /api/v1/wallet`)
* **Path:** `/api/v1/wallet`
* **Auth:** Required (`x-api-key`)

```json
{
  "success": true,
  "balance": 1450.50,
  "currency": "GHS"
}
```

### 18.2 Refund Policy & Accounting Rules
1. **Unverified MTN Beneficiaries:** Intercepted BEFORE charging. **Zero debit occurs, so zero refund is necessary.**
2. **Failed Orders:** If a valid order is debited and subsequently rejected by DataHouse, ByteBeacon automatically issues an immediate, full wallet refund.
3. **Revenue Calculation:** Platform revenue is calculated **exclusively** from successfully `completed` / `fulfilled` orders. Failed, rejected, and refunded transactions are excluded from revenue.

---

## 19. Webhooks & Event Notifications

ByteBeacon dispatches asynchronous HTTP POST webhooks when order states change.

### 19.1 Webhook Security Specs
* **HMAC Signature:** Header `x-bytebeacon-signature = HMAC-SHA256(raw_json_body, api_secret)`.
* **SSRF Protection:** Webhook URLs resolving to loopback (`127.0.0.1`), private subnets, or cloud metadata IPs (`169.254.169.254`) are strictly blocked.
* **Retries:** Failed deliveries are retried up to 5 attempts with exponential backoff (0s, 1m, 5m, 15m, 60m).

### 19.2 Supported Webhook Events
* `order.received` — Bulk or single order accepted.
* `order.processing` — Transmitted to DataHouse.
* `order.completed` — Bundle delivered successfully.
* `order.failed` — Order fulfillment failed; refund issued.
* `order.pending_mtn_approval` — Recipient queued for MTN approval.

---

## 20. Errors Reference Table

| HTTP Code | Error Code | Description | Recommended Action |
| :--- | :--- | :--- | :--- |
| `400` | `BAD_REQUEST` | Missing parameters (`network`, `phone`, `plan_id`) or invalid UUID. | Check request body parameters. |
| `401` | `UNAUTHORIZED` | Invalid or missing API key, or invalid HMAC signature. | Verify API key and signature HMAC secret. |
| `403` | `SUPERAGENT_REQUIRED` | Standard `agent` role attempted developer API access. | Upgrade user role to `superagent`. |
| `404` | `NOT_FOUND` | Bundle plan ID or transaction ID not found. | Check plan ID in `/api/v1/plans`. |
| `400` | `INSUFFICIENT_BALANCE`| Prepaid wallet balance insufficient. | Topup wallet balance. |
| `422` | `BENEFICIARY_NOT_VALIDATED` | Unverified MTN recipient intercepted before ordering. | Wait for MTN approval or use precheck API. |
| `429` | `TOO_MANY_REQUESTS` | Rate limit exceeded. | Implement backoff retry. |

---

## 21. Sandbox / Test Mode

To test integrations without spending real money or modifying live telecom networks, use test API keys (`ak_test_...` or `dk_test_...`).

* **Simulated Wallet:** Deductions occur against a virtual test balance.
* **Simulated Delivery:** Orders succeed or fail based on test phone patterns without hitting live DataHouse endpoints.

---

## 22. API Code Examples

### 22.1 JavaScript / Node.js Single Order Example
```javascript
const axios = require('axios');

async function placeOrder() {
  try {
    const response = await axios.post('https://www.bytebeacon.online/api/v1/data/purchase', {
      reference: `tx_${Date.now()}`,
      network: "MTN",
      phone: "0241234567",
      plan_id: "e5c3b9d2-7a1b-4c3e-8f9d-0e1a2b3c4d5e"
    }, {
      headers: {
        'x-api-key': 'ak_live_xxxxxxxxxxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json'
      }
    });

    console.log('Order Placed:', response.data);
  } catch (error) {
    if (error.response && error.response.status === 422) {
      console.warn('⚠️ MTN Beneficiary Pending Approval:', error.response.data.message);
    } else {
      console.error('Order Error:', error.response ? error.response.data : error.message);
    }
  }
}

placeOrder();
```

### 22.2 Python Bulk Order Example
```python
import requests

url = "https://www.bytebeacon.online/api/bulk-orders"
headers = {
    "x-api-key": "ak_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json"
}
payload = {
    "network": "MTN",
    "dataAmount": "1GB",
    "recipients": ["0241234567", "0551234567", "0594506310"],
    "onUnvalidated": "set_aside"
}

response = requests.post(url, json=payload, headers=headers)
print("HTTP Status:", response.status_code)
print("Response:", response.json())
```

---

## 23. Changelog

### Version 3.0.0 (August 2026)
* **RBAC Differentiation:** Formally separated standard `agent` (Storefront UI) from `superagent` (Developer API keys).
* **MTN Pre-Validation Architecture:** Intercepted unverified MTN numbers BEFORE order creation, returning `HTTP 422 BENEFICIARY_NOT_VALIDATED` with zero wallet debit.
* **High-Capacity Bulk Engine:** Launched asynchronous bulk ordering capable of processing 10,000 recipients per batch with server-side pagination.
* **DataHouse 2-Way Synchronization:** Integrated status transition guards to protect terminal states and automate wallet refunds on failure.
* **Revenue Accounting Policy:** Excluded failed, rejected, refunded, and pending MTN approvals from platform sales revenue.
