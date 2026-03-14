# Arquitectura

`api-wa-gateway` es un monolito modular con cinco capas principales:

- `src/domain`: entidades y enums de dominio sin dependencia de Fastify, Drizzle o Baileys.
- `src/application`: casos de uso, puertos de repositorio, puertos de proveedor y orquestación de despachos a webhooks.
- `src/infrastructure`: repositorios de PostgreSQL/Drizzle, cliente HTTP de webhooks, adaptadores de proveedor y composición del runtime.
- `src/interfaces/http`: rutas de Fastify, validación de requests y presenters de respuesta.
- `tests`: pruebas unitarias y HTTP con implementaciones en memoria.

## Módulos principales

- `tenants`: búsqueda de tenants y verificación de activación.
- `messaging`: contactos, conversaciones, mensajes y APIs de consulta.
- `providers`: despacho outbound a proveedores y normalización inbound.
- `webhooks`: resolución de webhook por tenant, generación de firma y auditoría de despachos.

## Flujo del MVP

### Inbound

1. Baileys recibe un evento para una `provider_connection` activa.
2. El adaptador de Baileys resuelve `tenantId` desde el contexto de la conexión.
3. `ReceiveInboundMessageUseCase` encuentra o crea el contacto y la conversación.
4. El mensaje se persiste con el payload normalizado y el payload crudo del proveedor.
5. `DefaultWebhookDispatchService` resuelve la suscripción de webhook activa y despacha un payload estándar.
6. El resultado del despacho se guarda en `webhook_dispatches`.

### Outbound

1. `POST /api/v1/tenants/:tenantId/messages` valida el request con Zod.
2. `SendOutboundMessageUseCase` resuelve la conexión activa del proveedor para el tenant.
3. El adaptador del proveedor envía el mensaje.
4. El mensaje outbound se persiste y se vincula a la conversación.

## Supuestos operativos

- Una conexión de proveedor activa por tenant en el MVP.
- Una suscripción de webhook activa por tenant en el MVP.
- Una conversación por `(tenantId, contactId, channel)` en el MVP.
- Tipos de mensaje soportados: `text`, `image`, `document`.
- El envío outbound de media es solo basado en URL.
