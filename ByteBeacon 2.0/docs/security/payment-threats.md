# Payment Threats & Countermeasures

Status: `FOUNDATION ONLY` (Provider Contract Isolation)

---

## 1. Threat Scenarios & Mitigations

### 1.1 Client Price Tampering
- **Threat**: Attacker modifies client-side JavaScript or payload to submit a lower bundle amount.
- **Mitigation**: Price amounts submitted by clients are completely discarded. The server queries authoritative catalog prices in PostgreSQL within an ACID transaction.

### 1.2 Underpaid Transactions
- **Threat**: Attacker initializes a checkout session for 100 GHS, completes payment for 1 GHS via manipulated channels.
- **Mitigation**: Paystack verification response is checked for `data.amount === order.expected_amount_pesewas`. Any mismatch results in immediate transaction freezing and fraud logging.

### 1.3 Provider Mock Inadvertent Production Execution
- **Threat**: Mock payment provider left active on live production environment, allowing fake settlements.
- **Mitigation**: The `MockPaymentProvider` constructor actively enforces `NODE_ENV === 'production' && ALLOW_MOCK_PROVIDERS !== 'true'` check and aborts server execution immediately if activated improperly.
