# ADR 0003: Password Hashing with Argon2id

## Status
`ACCEPTED` (CONFIRMED SOURCE RECOMMENDATION - OWASP ASVS 4.0 / NIST SP 800-63B)

## Context
Standard algorithms like bcrypt or PBKDF2 are increasingly vulnerable to GPU and ASIC acceleration. Password storage must resist modern side-channel and parallel hardware attacks.

## Decision
Adopt `Argon2id` as the exclusive password hashing algorithm with configurable memory, time, and parallelism work factors.

## Consequences
- High resistance to GPU cracking via memory hardness (default 64 MB memory cost).
- Requires continuous latency benchmarking on production hardware to ensure hashing latency stays between 200ms and 500ms.
