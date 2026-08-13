# ADR 0002: Fastify as Core Backend HTTP Engine

## Status
`ACCEPTED` (BYTEBEACON DECISION)

## Context
High-throughput telecom and payment routing requires an asynchronous, low-overhead HTTP engine with first-class schema validation and structured JSON logging.

## Decision
We select `Fastify` over Express for the backend runtime.

## Consequences
- Built-in schema validation and serialization.
- High request throughput.
- Encapsulated plugin and hook lifecycle with native support for structured Pino logging.
