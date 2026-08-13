# Comprehensive Threat Model: ByteBeacon 2.0

Status: `FOUNDATION ONLY` (Security Baseline)  
Target: OWASP ASVS 4.0 Level 2 / NIST SP 800-63B

---

## Threat Matrix (All 27 Threat Vectors)

| # | Attack Vector | Affected Boundary | Potential Impact | Preventive Control | Detective Control | Recovery / Control Strategy | Phase |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :- |
| 1 | **Credential Stuffing** | Auth API Gateway | Account takeover, automated brute force | Redis-backed IP/Account rate limiting, Argon2id hashing | Anomaly detection on failed logins | Automated account lockouts & CAPTCHA trigger | Phase 2 |
| 2 | **Password Spraying** | Auth API Gateway | Account compromise via low-frequency passwords | Global rate limiting across endpoints, password complexity checks | Alerting on multiple failed logins across different accounts | IP reputation scoring, temporary IP banning | Phase 2 |
| 3 | **Brute Force** | Auth & API Keys | Unauthorized resource access | Strict exponential backoff, account cooldown periods | Real-time threshold alerts on auth endpoints | Immediate throttling and admin alerting | Phase 2 |
| 4 | **Session Hijacking** | Cookie / JWT Boundary | Impersonation of legitimate users | `HttpOnly`, `Secure`, `SameSite=Strict` cookies, cryptographically signed tokens | Monitoring IP / User-Agent shifts per session | Immediate session revocation via Redis blacklist | Phase 2 |
| 5 | **CSRF** | State-changing HTTP routes | Unauthorized actions on behalf of authenticated users | SameSite cookies, custom anti-CSRF request headers (`x-request-id`, custom tokens) | CSRF mismatch error logging with request IDs | Reject unauthorized request, invalidate tainted token | Phase 2 |
| 6 | **XSS (Stored/Reflected/DOM)** | Frontend UI Layer | Session token theft, malicious script injection | React automated DOM escaping, Strict CSP via `@fastify/helmet` | CSP violation report-only endpoints | Emergency CSP tightening, sanitize persistent DB records | Phase 1 (CSP) / Phase 2 |
| 7 | **SQL Injection** | Database Access Layer | Data breach, arbitrary data exfiltration | Parameterized queries with `pg` client, zero raw SQL concatenation | WAF signature inspection, Postgres query audit logs | Immediate parameterization patch, DB restore from snapshot | Phase 1 (Pool parameterized) |
| 8 | **BOLA / IDOR** | Resource API Handlers | Unauthorized access to other users' records | Strict tenant-ownership validation in domain layer | Audit logs comparing requester principal to resource owner | Reject with 404/403, flag suspicious account | Phase 2 |
| 9 | **Privilege Escalation** | RBAC / Auth Boundary | Unauthorized admin access | Server-side role enforcement, immutable claim verification | Access denied logs for administrative endpoints | Session termination, account quarantine | Phase 2 |
| 10 | **API Abuse / Scraping** | Public Endpoints | Resource starvation, competitive intelligence loss | Redis rate-limiter, Cloudflare WAF, API token quotas | Real-time rate limit hit metrics in Prometheus | Progressive traffic throttling, IP drop rules | Phase 2 |
| 11 | **API Secret Theft** | Environment & Repo | Full platform compromise | Zero secrets in repo/shared package, secret managers | Secret scanning in CI (TruffleHog), audit logs | Immediate secret rotation & revoking compromised credentials | Phase 1 |
| 12 | **Replay Attacks** | Webhook & API Endpoints | Duplicate financial actions | Timestamp expiration window, nonce verification | Nonce collision detection logs | Discard stale requests older than 300 seconds | Phase 2 |
| 13 | **Webhook Forgery** | Webhook Receiver | Fake payment or order fulfillment | Cryptographic HMAC-SHA512 signature validation | Signature verification failure alerts | Immediate 401 response, IP ban on persistent forge | Phase 2 |
| 14 | **Webhook Replay** | Webhook Receiver | Multiple balance credits for single payment | Redis deduplication lock using provider transaction reference | Duplicate event logs with provider reference | Idempotent acknowledgment (return 200 without re-processing) | Phase 2 |
| 15 | **Payment Tampering** | Checkout Pipeline | Paying less than actual bundle cost | Resolving price server-side only; never trust frontend amount | Discrepancy check between verified payment and order record | Auto-freeze transaction and flag for manual reconciliation | Phase 2 |
| 16 | **Price Manipulation** | Order Placement | Exploiting discount or rounding errors | Strict integer math in minor currency units (pesewas), server pricing engine | Automated price audit alerts | Reject order, cancel tainted session | Phase 2 |
| 17 | **Concurrent Double Spending**| Wallet / Ledger Layer | Balance exhaustion exceeding limit | Strict PostgreSQL row locking (`SELECT FOR UPDATE`), isolated double-entry ledger | Transaction balance check constraint violations | Database level rollback, optimistic lock retry | Phase 2 |
| 18 | **Ledger Race Conditions** | Financial Engine | Inconsistent financial totals | ACID transactions, strict debit=credit balance invariant | Continuous automated ledger reconciliation jobs | Atomic rollback, alert finance engineering | Phase 2 |
| 19 | **Duplicate Order Placement**| Order API | Multiple telecom dispatches for one intent | Client-supplied Idempotency-Key enforced via Redis | Idempotency key collision tracking | Return existing order state without re-dispatch | Phase 2 |
| 20 | **Duplicate Payment Processing**| Payment Gateway | Double-charging customers | Idempotent Paystack transaction reference generation | Double webhook notification detection | Prevent second charge attempt, automated refund trigger | Phase 2 |
| 21 | **Duplicate Telecom Dispatch**| Telecom Gateway | Delivering double data bundles | Atomic order state machine transitions (`PENDING -> DISPATCHING -> COMPLETED`) | Telecom provider reference idempotency check | Disallow dispatch if state is not in valid pre-dispatch state | Phase 2 |
| 22 | **Provider Timeout Ambiguity**| Telecom / Payment Gateways | Unsettled orders, unknown order states | Asynchronous polling fallback and webhook reconciliation workers | Timeout threshold logs on provider requests | Mark state `PROCESSING_UNKNOWN`, queue for status check | Phase 2 |
| 23 | **Provider Webhook Spoofing**| Ingress Endpoints | Unverified order state alteration | Provider IP allowlisting + HMAC-SHA512 secret checks | Raw payload mismatch logging | Drop packet, notify security operations | Phase 2 |
| 24 | **Rate-Limit Bypass** | Edge / API Gateway | DoS on backend services | Combined IP + User + Device fingerprint throttling | Rate-limit spike telemetry | Blackhole offending IPs at edge firewall | Phase 2 |
| 25 | **Resource Exhaustion (DoS)**| Backend Fastify Engine | Server crash, memory starvation | Fastify 1MB body limit, connection timeouts, cluster pools | Memory/CPU usage alerts, Pino error rates | Scale horizontal pods, drop high-payload requests | Phase 1 (Body limit & timeouts) |
| 26 | **Malicious CSV Uploads** | Batch Processing Pipeline | ReDoS, CSV formula injection, memory overflow | Upload size limit, strict stream parser, sanitizing leading `=, +, -, @` | Parser anomaly & error alerts | Reject file with structured 400 error | Phase 2 |
| 27 | **Shared Package Secret Leakage**| `@bytebeacon/shared` | Exposure of backend credentials to frontend bundle | Strict static boundary: shared package contains pure types/interfaces only | Build-time secret detection, ESLint boundary rules | Immediate CI build failure if server modules imported | Phase 1 |
