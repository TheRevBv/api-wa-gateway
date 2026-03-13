# api-wa-gateway

WhatsApp API gateway built as a modular monolith with Fastify, PostgreSQL, Drizzle, Zod, Vitest and Pino.

## What is included

- inbound/outbound message orchestration
- persistence for tenants, contacts, conversations, messages and webhook dispatches
- tenant-scoped conversation query API
- webhook routing with signature support and retry inline
- Baileys adapter for local/dev sessions
- Meta WhatsApp Cloud API adapter for outbound and inbound webhook processing

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
http://localhost:8001/auth/baileys?auth=<BAILEYS_DASHBOARD_AUTH_TOKEN>
```

- Optional filters:

```text
http://localhost:8001/auth/baileys?auth=<token>&tenantId=tenant_demo
http://localhost:8001/auth/baileys?auth=<token>&connectionKey=demo-baileys-session
```

## Meta Cloud API notes

- Meta uses the existing `provider_connections` table with `provider = 'meta'`.
- `connection_key` must be the WhatsApp `phone_number_id`.
- Only one provider connection should stay active per tenant at a time.
- Meta webhook endpoints:

```text
GET  /webhooks/meta/:connectionKey
POST /webhooks/meta/:connectionKey
```

- Required `provider_connections.config` shape for Meta:

```json
{
  "accessToken": "EAA...",
  "verifyToken": "my-verify-token",
  "appSecret": "my-app-secret",
  "apiVersion": "v23.0"
}
```

- Example SQL after creating the tenant:

```sql
UPDATE provider_connections
SET
  provider = 'meta',
  connection_key = '<PHONE_NUMBER_ID>',
  display_name = 'Acme Meta Production',
  config = jsonb_build_object(
    'accessToken', '<META_ACCESS_TOKEN>',
    'verifyToken', '<META_VERIFY_TOKEN>',
    'appSecret', '<META_APP_SECRET>',
    'apiVersion', 'v23.0'
  ),
  updated_at = NOW()
WHERE id = 'provider_connection_acme';
```

- Meta sends inbound media references as provider media IDs. The gateway persists those IDs in `message.media.providerMediaId`.

## Testing

```bash
pnpm test
```

## Extra tooling

- SQL manual para alta de tenant: `scripts/sql/add-tenant.sql`
- Coleccion Postman: `docs/postman/api-wa-gateway.postman_collection.json`
- OpenAPI JSON: `docs/openapi/api-wa-gateway.openapi.json`

## Provider model

- `ProviderConnection` remains the tenant-provider binding.
- `BaileysWhatsAppProvider` and `MetaWhatsAppProvider` share the same internal port.
- Outbound still flows through the same `SendOutboundMessageUseCase`.
- Inbound still lands in the same `ReceiveInboundMessageUseCase`.
