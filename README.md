# api-wa-gateway

WhatsApp API gateway built as a modular monolith with Fastify, PostgreSQL, Drizzle, Zod, Vitest and Pino.

## What is included

- inbound/outbound message orchestration
- persistence for tenants, contacts, conversations, messages and webhook dispatches
- tenant-scoped conversation query API
- webhook routing with signature support and retry inline
- Baileys adapter prepared as the initial provider

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```bash
docker compose --env-file .env -p api-wa-gateway up -d
```

3. Install dependencies:

```bash
pnpm install
```

4. Run migrations and seed:

```bash
pnpm db:migrate
pnpm db:seed
```

5. Start the API:

```bash
pnpm dev
```

## HTTP API

### Health

```bash
curl http://localhost:8001/health
```

### Send outbound message

```bash
curl -X POST http://localhost:8001/api/v1/tenants/tenant_demo/messages \
  -H "content-type: application/json" \
  -d '{
    "to": "5215512345678",
    "content": {
      "type": "text",
      "text": "hola desde api-wa-gateway"
    }
  }'
```

### List conversations

```bash
curl "http://localhost:8001/api/v1/tenants/tenant_demo/conversations?limit=20&offset=0"
```

### List messages in a conversation

```bash
curl "http://localhost:8001/api/v1/tenants/tenant_demo/conversations/<conversation-id>/messages?limit=50&offset=0"
```

## Baileys notes

- Enable Baileys with `ENABLE_BAILEYS=true`.
- Set `BAILEYS_DASHBOARD_AUTH_TOKEN` to protect the QR dashboard.
- On boot, the runtime loads active `provider_connections` with `provider=baileys`.
- Session auth files are stored under `BAILEYS_AUTH_DIR/<connectionKey>`.
- QR values are logged by the provider runtime when a new session needs pairing.
- Web login/QR dashboard:

```text
http://localhost:3000/auth/baileys?auth=<BAILEYS_DASHBOARD_AUTH_TOKEN>
```

- Optional filters:

```text
http://localhost:3000/auth/baileys?auth=<token>&tenantId=tenant_demo
http://localhost:3000/auth/baileys?auth=<token>&connectionKey=demo-baileys-session
```

## Testing

```bash
pnpm test
```

## Extra tooling

- SQL manual para alta de tenant: `scripts/sql/add-tenant.sql`
- Coleccion Postman: `docs/postman/api-wa-gateway.postman_collection.json`

## Migration path to Meta

- Keep using `ProviderConnection` as the tenant-provider binding.
- Add a `MetaWhatsAppProvider` implementing the same `WhatsAppProvider` port.
- Reuse the same inbound normalized contract and outbound application use case.
