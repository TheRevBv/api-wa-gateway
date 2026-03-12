# ADR 0001: Modular Monolith

## Status

Accepted

## Decision

Build `api-wa-gateway` as a single deployable Node.js service with internal module boundaries:

- `domain`
- `application`
- `infrastructure`
- `interfaces/http`

## Why

- The product scope is still Fase 1.
- The main risk is coupling to providers, not service distribution.
- A single service keeps delivery speed high and operational complexity low.

## Consequences

- Module contracts are explicit through ports and use cases.
- Cross-module calls stay in-process.
- Future extraction is possible only if real scaling pressure appears.
