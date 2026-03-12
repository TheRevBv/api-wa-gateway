# Architecture

`api-wa-gateway` is a modular monolith with five top-level layers:

- `src/domain`: entities and domain enums with no dependency on Fastify, Drizzle or Baileys.
- `src/application`: use cases, repository ports, provider ports and webhook dispatch orchestration.
- `src/infrastructure`: PostgreSQL/Drizzle repositories, webhook HTTP client, provider adapters and runtime composition.
- `src/interfaces/http`: Fastify routes, request validation and response presenters.
- `tests`: unit and HTTP tests with in-memory fakes.

## Main modules

- `tenants`: tenant lookup and activation checks.
- `messaging`: contacts, conversations, messages and query APIs.
- `providers`: outbound provider dispatch and inbound normalization.
- `webhooks`: tenant webhook resolution, signature generation and dispatch auditing.

## MVP flow

### Inbound

1. Baileys receives an event for an active `provider_connection`.
2. The Baileys adapter resolves `tenantId` from the connection context.
3. `ReceiveInboundMessageUseCase` finds or creates contact and conversation.
4. The message is persisted with the normalized payload plus raw provider payload.
5. `DefaultWebhookDispatchService` resolves the active webhook subscription and dispatches a standard payload.
6. The webhook dispatch result is stored in `webhook_dispatches`.

### Outbound

1. `POST /api/v1/tenants/:tenantId/messages` validates the request with Zod.
2. `SendOutboundMessageUseCase` resolves the active provider connection for the tenant.
3. The provider adapter sends the message.
4. The outbound message is persisted and linked to the conversation.

## Operational assumptions

- One active provider connection per tenant in the MVP.
- One active webhook subscription per tenant in the MVP.
- One conversation per `(tenantId, contactId, channel)` in the MVP.
- Supported message types: `text`, `image`, `document`.
- Media outbound is URL-based only.
