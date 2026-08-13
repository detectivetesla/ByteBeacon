# API Partner & Agent Storefront Threats

Status: `FOUNDATION ONLY` (Isolation Boundaries)

---

## 1. Threat Scenarios

### 1.1 API Key Compromise
- **Threat**: Agent's secret API key leaked or extracted from public frontend code.
- **Mitigation**: API keys are hashed in the database using SHA-256 before storage (only key prefixes stored in plain text). Ingress middleware validates HMAC or hash signatures. Keys can be rotated instantly without service downtime.

### 1.2 Rate Limit Exhaustion & Runaway Loops
- **Threat**: Misconfigured partner script bombards order placement endpoints.
- **Mitigation**: Redis token bucket rate limiters per API key and per IP tier. Exceeding quotas returns `429 Too Many Requests` with retry headers.
