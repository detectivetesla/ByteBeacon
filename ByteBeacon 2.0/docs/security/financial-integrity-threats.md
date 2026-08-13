# Financial Integrity & Double-Entry Ledger Threats

Status: `DEFERRED` (Architecture Principles Established)

---

## 1. Core Financial Invariants

1. **Integer Arithmetic**: All monetary quantities are stored and manipulated as integers in minor currency units (Ghanaian Pesewas: `100 Pesewas = 1 GHS`). Floating-point numbers are strictly forbidden for currency math.
2. **Double-Entry Ledger Principle**: Money is never created or destroyed arbitrarily. Every transaction consists of balanced journal entries where `SUM(debits) === SUM(credits)`.
3. **Immutable History**: Ledger entries are append-only. Corrections require compensating reversal entries.
4. **Row-Level Locking**: Wallet balance updates must use `SELECT FOR UPDATE` within PostgreSQL serializable or read-committed transactions to prevent race-condition overdrafts.
