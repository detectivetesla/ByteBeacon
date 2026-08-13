# Attack Surface Analysis

Status: `FOUNDATION ONLY`

---

## 1. Exposed HTTP Endpoints in Phase 1

| Endpoint | Method | Authentication | Exposure Risk | Mitigations in Phase 1 |
| :--- | :--- | :--- | :--- | :--- |
| `/healthz` | GET | None (Public) | Low (Liveness Probe) | Fast static response, no DB/Redis queries, no internal info leaked |
| `/readyz` | GET | None (Public / Internal) | Low (Readiness Probe) | Returns structured dependency status without credentials or stack traces |

---

## 2. Planned Phase 2 Surface & Controls

| Planned Surface | Target Security Controls |
| :--- | :--- |
| **Authentication Routes** | Argon2id hashing, strict rate limiting, CAPTCHA on anomaly |
| **Order Placement Routes** | Idempotency keys, integer arithmetic in pesewas, server-authoritative pricing |
| **Provider Webhooks** | HMAC-SHA512 signature verification, replay protection, deduplication locks |
| **Admin Management Routes**| Strict RBAC role enforcement, IP allowlisting, immutable audit logs |
| **Batch Bulk Uploads** | 5MB stream limit, CSV formula injection neutralization |
