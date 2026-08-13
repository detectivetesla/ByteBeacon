# ByteBeacon Architecture: System Overview

Internal Development Designation: **ByteBeacon 2.0**  
Production & Customer Brand: **ByteBeacon**  
Status: `FOUNDATION ONLY` (Phase 1 Baseline)

---

## 1. High-Level Architecture Topology

```
+-------------------------------------------------------------+
|                     Client Applications                     |
|  - Web Application (React + Vite, WCAG 2.2 AA Design System)|
|  - Agent Portals (Planned Phase 2)                          |
+------------------------------+------------------------------+
                               | HTTPS / WSS
                               v
+-------------------------------------------------------------+
|                     API & Security Layer                    |
|  - Fastify HTTP Engine (createApp Factory)                  |
|  - Helmet Security Headers & Strict CORS Allowlist          |
|  - Request ID Correlation & Centralized Pino Redaction      |
|  - Standardized Error Handling (No Secret Leakage)          |
+------------------------------+------------------------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  Infrastructure Layer |             |  Provider Boundaries  |
|  - PostgreSQL Pool    |             |  - IPaymentProvider   |
|  - Versioned Migrator |             |  - ITelecomProvider   |
|  - Redis Client       |             |  - INotification      |
+-----------------------+             +-----------------------+
```

---

## 2. Package & Monorepo Boundaries

| Package | Purpose | Scope / Implementation Status |
| :--- | :--- | :--- |
| `@bytebeacon/shared` | Safe contracts, DTOs, public enums, status types | `IMPLEMENTED` (Zero secrets, zero DB logic) |
| `@bytebeacon/backend` | Fastify server, security filters, infrastructure, providers | `FOUNDATION ONLY` (Business logic deferred) |
| `@bytebeacon/frontend` | React shell, design system tokens, accessible UI primitives | `FOUNDATION ONLY` (Storefronts/dashboards deferred) |

---

## 3. Authoritative Source Classification Policy

Every architectural design decision and external dependency conforms to our classification policy:

1. **CONFIRMED EXTERNAL REQUIREMENT**: Verified via official vendor documentation (e.g. Paystack API documentation, W3C standards, RFC specs).
2. **CONFIRMED SOURCE RECOMMENDATION**: Verified security standards (OWASP ASVS 4.0, NIST SP 800-63B).
3. **BYTEBEACON DECISION**: Deliberate internal architectural choices (e.g., Fastify over Express, pnpm Workspaces, Argon2id).
4. **PROPOSED**: Future architectural RFCs undergoing review.
5. **UNKNOWN**: Pending architectural investigation.
6. **AUTHORITATIVE SOURCE NOT VERIFIED**: Specifically applied to DataHouse telecom integration specifications until verified documentation is furnished.
