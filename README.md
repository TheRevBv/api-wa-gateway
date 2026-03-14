# api-wa-gateway

Gateway de API para WhatsApp construido como un monolito modular con Fastify, PostgreSQL, Drizzle, Zod, Vitest y Pino.

## Qué incluye

- orquestación de mensajes inbound y outbound
- persistencia de tenants, contactos, conversaciones, mensajes y despachos de webhooks
- API de consulta de conversaciones acotada por tenant
- ruteo de webhooks con soporte de firma y reintento inline
- adaptador de Baileys para sesiones locales y de desarrollo
- adaptador de Meta WhatsApp Cloud API para procesamiento inbound y outbound

## Configuración local

1. Copia `.env.example` a `.env`.
2. Levanta PostgreSQL:

```bash
docker compose --env-file .env -p api-wa-gateway up -d
```

3. Instala las dependencias:

```bash
pnpm install
```

4. Ejecuta migraciones y seed:

```bash
pnpm db:migrate
pnpm db:seed
```

5. Inicia la API:

```bash
pnpm dev
```

## HTTP API

### Health

```bash
curl http://localhost:8001/health
```

### Enviar mensaje outbound

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

### Listar conversaciones

```bash
curl "http://localhost:8001/api/v1/tenants/tenant_demo/conversations?limit=20&offset=0"
```

### Listar mensajes de una conversación

```bash
curl "http://localhost:8001/api/v1/tenants/tenant_demo/conversations/<conversation-id>/messages?limit=50&offset=0"
```

## Notas de Baileys

- Habilita Baileys con `ENABLE_BAILEYS=true`.
- Configura `BAILEYS_DASHBOARD_AUTH_TOKEN` para proteger el dashboard del QR.
- Al arrancar, el runtime carga los `provider_connections` activos con `provider=baileys`.
- Los archivos de sesión se guardan en `BAILEYS_AUTH_DIR/<connectionKey>`.
- Los valores del QR se registran en logs cuando una sesión nueva necesita pairing.
- Acceso web al dashboard/QR:

```text
http://localhost:8001/auth/baileys?auth=<BAILEYS_DASHBOARD_AUTH_TOKEN>
```

- Filtros opcionales:

```text
http://localhost:8001/auth/baileys?auth=<token>&tenantId=tenant_demo
http://localhost:8001/auth/baileys?auth=<token>&connectionKey=demo-baileys-session
```

## Notas de Meta Cloud API

- Meta usa la tabla existente `provider_connections` con `provider = 'meta'`.
- `connection_key` debe ser el `phone_number_id` de WhatsApp.
- Solo debe existir una conexión de proveedor activa por tenant al mismo tiempo.
- Endpoints de webhook para Meta:

```text
GET  /webhooks/meta/:connectionKey
POST /webhooks/meta/:connectionKey
```

- Forma requerida de `provider_connections.config` para Meta:

```json
{
  "accessToken": "EAA...",
  "verifyToken": "my-verify-token",
  "appSecret": "my-app-secret",
  "apiVersion": "v23.0"
}
```

- SQL de ejemplo después de crear el tenant:

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

- Meta envía referencias de media inbound como IDs de media del proveedor. El gateway persiste esos IDs en `message.media.providerMediaId`.

## Pruebas

```bash
pnpm typecheck
pnpm test
pnpm build
```

## CI/CD

- `CI` valida `typecheck`, tests, build de runtime, migraciones sobre PostgreSQL y `docker build` en `pull_request`.
- `Build & Push (GHCR)` valida, construye y publica la imagen en GHCR en `main`, `develop` y tags `v*.*.*`.
- `Deploy Dev` ocurre automáticamente después del publish cuando el push entra a `develop`.
- `Deploy Production` hace un despliegue manual a una VM Linux por SSH usando la imagen publicada y `deploy/compose.production.yml`.
- La guía operativa completa está en `docs/deployment.md`.

## Documentación para integradores

- Inicio rápido: `docs/integrator/quickstart.md`
- Referencia API: `docs/integrator/api.md`
- Webhooks: `docs/integrator/webhooks.md`
- Errores: `docs/integrator/errors.md`
- Alta de tenant e integración: `docs/integrator/tenant-onboarding.md`

## Herramientas extra

- SQL manual para alta de tenant: `scripts/sql/add-tenant.sql`
- Colección Postman: `docs/postman/api-wa-gateway.postman_collection.json`
- OpenAPI JSON: `docs/openapi/api-wa-gateway.openapi.json`
- Guía de despliegue: `docs/deployment.md`

## Modelo de proveedores

- `ProviderConnection` sigue siendo el vínculo entre tenant y proveedor.
- `BaileysWhatsAppProvider` y `MetaWhatsAppProvider` comparten el mismo puerto interno.
- El flujo outbound sigue pasando por `SendOutboundMessageUseCase`.
- El flujo inbound sigue entrando por `ReceiveInboundMessageUseCase`.
