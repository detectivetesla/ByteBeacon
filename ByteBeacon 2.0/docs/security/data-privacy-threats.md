# Data Privacy & Regulatory Compliance (Ghana DPA & GDPR)

Status: `FOUNDATION ONLY`

---

## 1. Regulatory Context

Compliance Target: **Data Protection Act, 2012 (Act 843) of Ghana** & International Privacy Standards.

---

## 2. Privacy Mitigations

1. **PII Masking in Application Logs**:
   - Customer phone numbers, email addresses, and names are masked in non-debug application logs.
   - Database credentials, API secrets, and tokens are automatically censored by Pino redaction paths.
2. **Data Minimization**:
   - Telecommunications order logs retain recipient phone numbers solely for the statutory duration required for telecom reconciliation.
3. **Encrypted Transit & Storage**:
   - TLS 1.3 enforced for all client-to-server and server-to-provider communications.
   - Sensitive database volumes encrypted at rest with AES-256.
