# Authentication Threats & Mitigations

Status: `FOUNDATION ONLY` (Security Architecture Baseline)

---

## 1. Password Storage & Cryptographic Hashing

- **Standard**: Argon2id (`argon2` engine)
- **Work Factors**:
  - Memory cost: 64 MB (`65536 KiB`) default baseline
  - Time cost: 3 iterations
  - Parallelism: 4 threads
- **Benchmarking Rule**: Work factors must be continuously verified via `pnpm --filter @bytebeacon/backend bench:argon2` to ensure hashing latency remains between 200ms and 500ms on production infrastructure.
- **Data Protection Invariant**: Passwords and plain credentials must NEVER be logged. Centralized Pino redaction strips all instances of `password`, `token`, `secret`.

---

## 2. Session & Token Threat Vectors

1. **Token Forgery**: Mitigated by cryptographically signed JWT tokens with short TTLs (15 minutes).
2. **Session Persistence Abuse**: Refresh tokens stored in PostgreSQL with one-time rotation and revocation tracking in Redis.
3. **Session Replay / Hijacking**: Tokens bound to client fingerprint and revoked across all devices upon password reset.
