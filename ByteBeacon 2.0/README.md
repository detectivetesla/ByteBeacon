# ByteBeacon (ByteBeacon 2.0)

Internal Development Designation: **ByteBeacon 2.0**  
Production & Customer-Facing Brand: **ByteBeacon**

This directory is the dedicated, isolated root for the ByteBeacon 2.0 clean-slate monorepo rebuild.

> [!IMPORTANT]
> **Isolation Rule**: The legacy ByteBeacon repository is strictly reference-only and must never be modified or used as the implementation target.
> **Phase 1 Scope**: **FOUNDATION ONLY**. All business domain tables, registration/login flows, wallets, double-entry ledger execution, orders, and live provider integrations are deferred to Phase 2.

---

## Workspace Structure

```
ByteBeacon 2.0/
├── apps/
│   ├── backend/       # Fastify backend application (@bytebeacon/backend)
│   └── frontend/      # React + Vite frontend shell (@bytebeacon/frontend)
├── packages/
│   └── shared/        # Safe shared TypeScript contracts (@bytebeacon/shared)
├── database/
│   └── migrations/    # Version-controlled SQL schema migrations
├── docs/              # Architectural decision records & security threat models
├── scripts/           # Verification and audit utilities
├── reports/           # Automated verification test results
└── .github/workflows/ # GitHub Actions CI configuration
```

---

## Technical Stack Baseline

- **Runtime**: Node.js 24 LTS
- **Backend**: Fastify, TypeScript strict mode, Pino, Zod, PostgreSQL pool (`pg`), Redis (`ioredis`), Argon2id
- **Frontend**: React, TypeScript, Vite, React Router, CSS Modules, CSS custom properties
- **Repository**: pnpm Workspaces
- **Infrastructure**: PostgreSQL, Redis boundary, Docker multi-stage build
- **Testing**: Vitest across all workspace packages

---

## Getting Started

### Installation

```bash
# Execute from ByteBeacon 2.0 root:
pnpm install
```

### Verification & Foundation Checks

```bash
# Run automated foundation audit
pnpm run verify

# Run TypeScript typecheck across all packages
pnpm run typecheck

# Run ESLint across workspace
pnpm run lint

# Run all Vitest suites
pnpm run test

# Build all production artifacts
pnpm run build
```

---

## License

Internal Proprietary — ByteBeacon Team
