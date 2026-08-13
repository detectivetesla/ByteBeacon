# Authority Boundaries & Zero-Trust Invariants

Status: `FOUNDATION ONLY` (Enforced in Architecture)

---

## 1. The Zero-Trust Client Model

ByteBeacon operates under the foundational security principle: **Every client request is hostile.**

### Untrusted Client Assertions
The backend server MUST NEVER trust:
1. **Prices / Rates**: Prices submitted in order requests are discarded; authoritative rates are resolved server-side.
2. **User Roles / Permissions**: Roles supplied in headers or payloads are ignored; validated against cryptographic sessions or signed JWT claims.
3. **Account / Wallet Balances**: Frontend balances are UI projections; all financial operations read strictly from PostgreSQL transactions.
4. **Payment / Telecom Status**: Webhooks and callbacks must be cryptographically verified; frontend redirect query parameters are never accepted as proof of settlement.
5. **UI State & Hidden Fields**: Disabled buttons or hidden inputs provide no security boundary.

---

## 2. Infrastructure Authority Boundaries

```
[ Frontend Client ]
        │  (Untrusted)
        ▼
[ Fastify API Layer ] ────► Authenticates Principals & Validates Schemas (Zod)
        │
        ▼
[ Application / Domain Layer ] ────► Enforces Business Invariants & Permissions
        │
        ├──────────────────────┬──────────────────────┐
        ▼                      ▼                      ▼
[ PostgreSQL Pool ]     [ Redis Cache ]     [ Provider Gateways ]
(Source of Truth)       (Ephemeral State)   (External Idempotency)
```

- **PostgreSQL Pool**: Sole authoritative persistence for state, financial double-entry ledgers, and system metadata. Route handlers are strictly forbidden from creating independent DB connections.
- **Redis Client**: Dedicated boundary for rate limiting, ephemeral session blacklists, distributed locks, and idempotency tracking.
- **Shared Package Boundary**: Must NEVER import or expose secrets, database drivers, or server-side execution privileges.
