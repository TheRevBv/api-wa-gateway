# ADR 0002: Tenant Resolution Through Provider Connection Context

## Status

Accepted

## Decision

Inbound messages are processed with an explicit `tenantId` injected by the provider adapter from the active `provider_connection`.

## Why

- Baileys does not provide tenant identity directly.
- The gateway must stay tenant-aware without heuristics based on business payloads.
- This keeps the application layer independent from provider-specific session details.

## Consequences

- Every active provider connection belongs to exactly one tenant.
- Inbound processing depends on correct provider connection configuration.
- Meta can reuse the same internal contract later.
