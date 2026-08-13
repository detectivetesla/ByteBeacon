# Security Trust Boundaries

Status: `IMPLEMENTED` / `FOUNDATION ONLY`

---

## Trust Boundary Architecture

```
[ UNTRUSTED ZONE: Public Internet ]
      │  Web Browsers, Mobile Apps, Third-Party Agents
      ▼
═══════════════════════════════════════════════════════════════
 TRUST BOUNDARY 1: Edge & Ingress Filters
  - HTTPS / TLS 1.3 Termination
  - Helmet Security Headers (CSP, X-Frame, HSTS)
  - Strict CORS Origin Allowlist
  - Request Body Limit (1MB) & Request ID Tracking
═══════════════════════════════════════════════════════════════
      │
      ▼
[ SEMI-TRUSTED ZONE: API Gateway Layer ]
  - Zod Request Schema Validation
  - Route Handlers & Centralized Error Handler
  - Logging Redaction (Pino Sensitive Masking)
      │
═══════════════════════════════════════════════════════════════
 TRUST BOUNDARY 2: Core Domain & Authorization Perimeter
  - Authentication Token Verification
  - RBAC Scope Validation (Customer vs Agent vs Admin)
  - Zero-Trust Business Logic Execution
═══════════════════════════════════════════════════════════════
      │
      ├──────────────────────┬──────────────────────┐
      ▼                      ▼                      ▼
[ TRUSTED ZONE ]       [ TRUSTED ZONE ]       [ EXTERNAL PROVIDER ZONE ]
  PostgreSQL Pool        Redis Infrastructure   Payment & Telecom Gateways
  (ACID Ledger)          (Ephemeral Caches)     (Untrusted Responses)
```

---

## Perimeter Invariants

1. **Client Isolation**: The client runtime is untrusted. No financial authorization or inventory calculation takes place on the client.
2. **Provider Isolation**: Third-party providers (Paystack, Telecom vendors) operate outside our trusted zone. Responses and webhooks are validated with cryptographic signatures and idempotent database locks before committing state changes.
3. **Shared Code Isolation**: The `@bytebeacon/shared` package represents an untrusted boundary from a credential perspective; it must never include secret keys or infrastructure clients.
