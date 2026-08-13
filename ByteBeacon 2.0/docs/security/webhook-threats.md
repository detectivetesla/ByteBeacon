# Webhook Threats & Ingestion Defense

Status: `FOUNDATION ONLY`

---

## 1. Webhook Attack Vectors

### 1.1 Webhook Spoofing / Forgery
- **Threat**: Attacker sends simulated payment success webhooks to credit wallets or trigger telecom data dispatches.
- **Mitigation**: Every incoming webhook must validate its cryptographic signature (`x-paystack-signature` using HMAC-SHA512 with the secret key). Fastify route captures raw request buffer for byte-for-byte signature verification before parsing JSON.

### 1.2 Webhook Replay Attacks
- **Threat**: Attacker intercepts and replays a valid webhook payload to credit a balance multiple times.
- **Mitigation**: Redis distributed lock / idempotency record: `SET webhook:lock:{providerTxId} EX 86400 NX`. If the key already exists, return `200 OK` immediately without re-processing.

### 1.3 Unverified Telecom Webhooks (DataHouse Status)
- **Status**: `AUTHORITATIVE SOURCE NOT VERIFIED`
- **Rule**: DataHouse webhook signature schemes, headers, and payloads must not be fabricated. Concrete verification will only be implemented when authoritative vendor documentation is officially provided.
