# ADR 0001: Adoption of pnpm Workspaces Monorepo

## Status
`ACCEPTED` (BYTEBEACON DECISION)

## Context
ByteBeacon requires strong separation between shared contracts, frontend interfaces, and backend infrastructure. Single-repository or ad-hoc multi-repo configurations either risk secret leakage to the frontend bundle or incur heavy synchronization friction.

## Decision
We adopt `pnpm Workspaces` managing `@bytebeacon/shared`, `@bytebeacon/backend`, and `@bytebeacon/frontend`.

## Consequences
- Fast, atomic builds with disk-efficient deduplication.
- Strong boundary rules: `@bytebeacon/shared` contains pure types and contracts; backend secrets and database drivers can never leak to the client bundle.
