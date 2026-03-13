# Plan de trabajo por fases para Fase 1 de `api-wa-gateway`

## 1. Comprensión del objetivo
- Construir un gateway/API de WhatsApp en arquitectura `modular monolith`, arrancando desde un repositorio vacío.
- El MVP de Fase 1 debe cubrir inbound, outbound, persistencia, consulta de conversaciones, ruteo por tenant a webhook y registro de dispatches.
- La base debe quedar lista para usar Baileys ahora y permitir agregar Meta después sin rediseñar dominio ni casos de uso.

## 2. Alcance exacto de la tarea
- Entregar un plan de ejecución por fases, no implementación.
- El plan cubre `foundation`, dominio, persistencia, integración WhatsApp, webhooks, API, testing y documentación.
- El foco es un MVP simple y operable, sin microservicios, sin admin panel y sin features fuera de alcance.

## 3. Supuestos relevantes
- El repositorio está vacío; el plan asume bootstrapping greenfield.
- Se usará un solo servicio Node.js con TypeScript, Fastify, PostgreSQL, Drizzle, Zod, Vitest y Pino.
- Se usará `pnpm` en un solo paquete; si el equipo prefiere `npm`, no cambia la arquitectura.
- La API pública quedará tenant-scoped por ruta: `/api/v1/tenants/:tenantId/...`.
- La capa de aplicación siempre recibe `tenantId` explícito; para Baileys, el adaptador lo inyecta desde la configuración de la sesión/conexión antes de llamar al caso de uso.
- MVP: soporte real para `text`, `image` y `document`; media outbound solo por URL y metadatos, sin upload binario al gateway.
- Configuración operativa de `tenants`, `webhook_subscriptions` y `provider_connections` vía migraciones + seeds/SQL manual, sin admin API en Fase 1.
- Un solo `webhook_subscription` activo por tenant en el MVP.
- Reintento de webhook en MVP: `1` retry inline después del intento inicial, con timeout corto; no worker diferido.
- Conversación MVP: una conversación activa por `(tenantId, contactId, channel)`; sin flujo de cierre/reapertura en esta fase.

## 4. Riesgos o dudas técnicas
- Baileys no trae `tenantId` “naturalmente” desde WhatsApp; el adaptador debe ser la fuente de verdad del tenant por sesión configurada.
- La persistencia de sesión/auth de Baileys puede volverse frágil si no se encapsula; para MVP conviene volumen local o store simple, no rediseño prematuro.
- Webhooks con retry inline pueden aumentar latencia del inbound; por eso el retry debe ser corto y acotado.
- Duplicados de mensajes inbound del proveedor deben bloquearse por idempotencia en DB, no solo en memoria.
- Media básica puede inflar el alcance si se intenta hacer upload o proxy de archivos; el plan lo evita usando URLs.

## 5. Plan en pasos pequeños

### Fase 0. Foundation
- Objetivo: dejar el proyecto arrancable y con esqueleto técnico limpio.
- Entregables concretos: bootstrap de Fastify, configuración TypeScript, logger Pino, carga de env, Docker Compose con PostgreSQL, Drizzle y Vitest configurados, estructura modular base.
- Tareas específicas: `[MVP]` definir layout `src/domain`, `src/application`, `src/infrastructure`, `src/interfaces/http`, `tests`; `[MVP]` crear bootstrap de app y healthcheck; `[MVP]` configurar DB local y scripts de migración/test; `[Después]` pipeline CI.
- Dependencias previas: ninguna.
- Riesgos técnicos: gastar demasiado tiempo en scaffolding o meter utilidades genéricas sin necesidad.
- Criterios de terminado: la app levanta, el healthcheck responde, PostgreSQL sube localmente y el runner de tests ejecuta.
- Estimación relativa de esfuerzo: `medio`.
- Paralelo: ADRs y documento de arquitectura pueden arrancar aquí.
- MVP: `obligatoria`.

### Fase 1. Dominio y contratos de aplicación
- Objetivo: congelar el modelo de negocio y los puertos internos antes de tocar integración externa.
- Entregables concretos: entidades, enums, value objects mínimos, puertos de repositorio, puertos de proveedor/webhook, contratos de casos de uso y DTOs normalizados.
- Tareas específicas: `[MVP]` definir módulos `tenants`, `messaging`, `providers`, `webhooks`; `[MVP]` modelar `Tenant`, `Contact`, `Conversation`, `Message`, `WebhookSubscription`, `WebhookDispatch`, `ProviderConnection`; `[MVP]` definir `ReceiveInboundMessage`, `SendOutboundMessage`, `ListConversations`, `GetConversation`, `ListConversationMessages`; `[MVP]` fijar modelo normalizado para `text/image/document`; `[Después]` estados más ricos de ack/delivery.
- Dependencias previas: Fase 0.
- Riesgos técnicos: sobreabstraer demasiado pronto o dejar contratos acoplados a Baileys.
- Criterios de terminado: el dominio no depende de Fastify, Drizzle ni Baileys; los casos de uso ya tienen entradas/salidas y errores esperados definidos.
- Estimación relativa de esfuerzo: `alto`.
- Paralelo: diseño de esquema DB y payload webhook pueden adelantarse una vez se congelen tipos e IDs.
- MVP: `obligatoria`.

### Fase 2. Persistencia
- Objetivo: llevar el dominio a PostgreSQL con Drizzle y dejar datos operables para el MVP.
- Entregables concretos: schema Drizzle, migraciones, índices, restricciones de unicidad, repositorios SQL y seeds/manual SQL.
- Tareas específicas: `[MVP]` crear tablas para entidades mínimas y `provider_connections`; `[MVP]` usar `JSONB` para `payloadRaw` y metadata de media; `[MVP]` definir idempotencia por `(tenantId, provider, providerMessageId)`; `[MVP]` implementar repositorios e índices para listados por tenant; `[MVP]` preparar seed/manual SQL para tenant, webhook y conexión de proveedor; `[Después]` endpoints de administración.
- Dependencias previas: Fase 1.
- Riesgos técnicos: modelar mal la unicidad de conversación, crecimiento de `payloadRaw`, o dejar mal preparado el config de proveedor.
- Criterios de terminado: migraciones aplican limpio, los seeds dejan un tenant funcional, y los repositorios cubren create/find/list/update de los flujos clave.
- Estimación relativa de esfuerzo: `alto`.
- Paralelo: contrato HTTP y DTOs de respuesta pueden definirse cuando IDs, enums y paginación estén cerrados.
- MVP: `obligatoria`.

### Fase 3. Integración WhatsApp con Baileys
- Objetivo: tener proveedor real para inbound/outbound bajo un adaptador propio.
- Entregables concretos: `WhatsAppProviderPort`, `BaileysWhatsAppProvider`, mapper de eventos inbound, envío outbound de texto e imagen/documento por URL, manejo de sesión/auth.
- Tareas específicas: `[MVP]` levantar sesiones por `provider_connection` activa; `[MVP]` mapear eventos Baileys a un `InboundProviderMessage` interno con `tenantId` ya resuelto; `[MVP]` enviar `text`, `image` y `document` por URL; `[MVP]` persistir payload crudo del proveedor para auditoría; `[Después]` implementar `MetaWhatsAppProvider`.
- Dependencias previas: Fases 1 y 2.
- Riesgos técnicos: reconexión de sesión, persistencia de credenciales, diferencias de payload, manejo de media remota.
- Criterios de terminado: existe smoke test/manual test de sesión funcional, recepción inbound real y envío outbound real con persistencia consistente.
- Estimación relativa de esfuerzo: `alto`.
- Paralelo: el payload builder de webhook puede avanzar una vez esté congelado el evento normalizado.
- MVP: `obligatoria`.

### Fase 4. Webhooks y ruteo por tenant
- Objetivo: despachar eventos normalizados al webhook activo del tenant y auditar el resultado.
- Entregables concretos: resolver de suscripción activa, payload estándar de webhook, firma con secreto, cliente HTTP de dispatch y registro de intentos/respuestas.
- Tareas específicas: `[MVP]` resolver una suscripción activa por tenant; `[MVP]` construir payload estándar sin exponer raw provider payload; `[MVP]` enviar con timeout corto y `1` retry inline; `[MVP]` registrar request, response, código, error y `attempts`; `[Después]` replay manual o worker diferido.
- Dependencias previas: Fases 1 y 2; integración inbound de Fase 3 para el flujo completo.
- Riesgos técnicos: latencia extra en inbound, side effects duplicados en sistemas externos, errores de firma/secreto.
- Criterios de terminado: cada inbound persistido genera dispatch auditable hacia el callback correcto y queda registro de éxito o fallo.
- Estimación relativa de esfuerzo: `medio`.
- Paralelo: API de lectura puede implementarse al mismo tiempo si ya existen repositorios y DTOs.
- MVP: `obligatoria`.

### Fase 5. API propia
- Objetivo: exponer la interfaz HTTP del gateway para envío y consulta de conversaciones.
- Entregables concretos: rutas Fastify, validación Zod, DTOs de respuesta, manejo consistente de errores y paginación.
- Tareas específicas: `[MVP]` `GET /health`; `[MVP]` `POST /api/v1/tenants/:tenantId/messages`; `[MVP]` `GET /api/v1/tenants/:tenantId/conversations`; `[MVP]` `GET /api/v1/tenants/:tenantId/conversations/:conversationId`; `[MVP]` `GET /api/v1/tenants/:tenantId/conversations/:conversationId/messages`; `[Después]` admin API para config.
- Dependencias previas: Fases 1 y 2; outbound funcional de Fase 3 para el endpoint de envío.
- Riesgos técnicos: mezclar reglas de negocio en controladores, inconsistencias de tenant scoping, errores de paginación/orden.
- Criterios de terminado: todos los endpoints validan entrada/salida con Zod y devuelven contratos estables por tenant.
- Estimación relativa de esfuerzo: `medio`.
- Paralelo: contract tests y documentación de ejemplos HTTP pueden avanzar aquí.
- MVP: `obligatoria`.

### Fase 6. Testing
- Objetivo: cubrir las rutas de mayor riesgo con pruebas que realmente protejan el MVP.
- Entregables concretos: unit tests, tests de integración de repositorios, tests de rutas HTTP y checklist de smoke/manual test para Baileys.
- Tareas específicas: `[MVP]` probar casos de uso con escenario feliz, error esperado y edge case; `[MVP]` probar mappers/provider adapters y payload builder de webhook; `[MVP]` probar repositorios Drizzle contra PostgreSQL de prueba; `[MVP]` probar idempotencia, retry y paginación; `[Después]` automatización end-to-end live contra Baileys.
- Dependencias previas: arranca en paralelo, pero cada suite depende del módulo correspondiente.
- Riesgos técnicos: exceso de mocks ocultando fallos reales o pruebas live demasiado frágiles.
- Criterios de terminado: los flujos críticos tienen cobertura útil y las regresiones esperables quedan protegidas.
- Estimación relativa de esfuerzo: `medio`.
- Paralelo: continua desde Fase 1 en adelante.
- MVP: `obligatoria`.

### Fase 7. Documentación
- Objetivo: dejar el proyecto operable por otro ingeniero sin transferencia oral.
- Entregables concretos: `README.md`, `.env.example`, `docs/architecture.md`, ADRs, ejemplos HTTP, guía de arranque local, notas Baileys y notas de migración a Meta.
- Tareas específicas: `[MVP]` documentar setup local, migraciones, seeds manuales, sesiones Baileys, ejemplos de send/read, contrato de webhook y troubleshooting básico; `[Después]` runbook operativo ampliado.
- Dependencias previas: puede iniciar en Fase 0; el cierre final depende de Fases 3 a 5.
- Riesgos técnicos: documentación desfasada respecto al comportamiento real.
- Criterios de terminado: un tercero puede levantar el proyecto, poblar config mínima, conectar Baileys, disparar mensajes y consultar historial siguiendo solo la documentación.
- Estimación relativa de esfuerzo: `medio`.
- Paralelo: ADRs desde el inicio; README final al final.
- MVP: `obligatoria`.

## 6. Archivos a crear o modificar
- Base técnica: `package.json`, `tsconfig.json`, `vitest.config.ts`, `docker-compose.yml`, `.env.example`, `README.md`.
- Código: `src/domain`, `src/application`, `src/infrastructure`, `src/interfaces/http`, `src/app.ts`, `src/server.ts`.
- Persistencia y pruebas: `drizzle/`, `scripts` o `sql` de seeds manuales, `tests/`.
- Documentación: `docs/architecture.md`, `docs/decisions/*.md`.

## 7. Implementación propuesta
- Módulos internos: `tenants`, `messaging`, `providers`, `webhooks`.
- Interfaces internas obligatorias: `WhatsAppProviderPort`, `WebhookDispatcherPort`, repositorios por agregado y tipos normalizados como `InboundProviderMessage`, `SendMessageCommand`, `SendMessageResult` y `WebhookEventPayload`.
- Política de datos MVP: `payloadRaw` guarda auditoría del proveedor y metadata de media; no habrá almacenamiento binario ni proxy de archivos.
- Política de operación MVP: una conexión de proveedor activa y una suscripción de webhook activa por tenant; configuración por seeds/manual SQL.

## 8. Código
- No aplica en este turno. Este entregable es solo de planeación.

## 9. Validaciones o pruebas
- Unitarias: casos de uso, validadores Zod, mappers, ruteo por tenant y construcción de payload webhook.
- Integración: repositorios Drizzle sobre PostgreSQL real de prueba, más pruebas HTTP de rutas Fastify.
- Smoke manual obligatorio: conectar una sesión Baileys de un tenant seed, recibir un inbound real, enviar un outbound real, verificar persistencia y dispatch a un webhook de prueba.
- Criterio de aceptación MVP: send, receive, persist, query y webhook dispatch funcionan de punta a punta para `text/image/document` por URL.

## 10. Resultado esperado
- Un backend arrancable en local, con persistencia propia, integración Baileys funcional, API de consulta/envío y ruteo por tenant a webhook con auditoría.
- Una base mantenible para Fase 2 y para sumar `MetaWhatsAppProvider` sin reescribir dominio ni casos de uso.

## Resumen ejecutivo de la estrategia
- La estrategia correcta es construir primero contratos internos y modelo de datos, luego cerrar el slice vertical `send/receive -> persist -> webhook -> query`.
- El MVP debe evitar complejidad operativa: sin admin API, sin uploads, sin worker de retries, sin cierres de conversación ni multi-webhook fan-out.
- La preparación para Meta no se logra implementando Meta ahora, sino dejando `provider ports`, `provider_connections` y mapeos normalizados correctamente separados.

## Propuesta de roadmap MVP
1. `Cut 1`: Fases 0 y 1 para congelar estructura, módulos y contratos.
2. `Cut 2`: Fase 2 para dejar DB, migraciones y seeds operables.
3. `Cut 3`: Fases 3 y 4 para cerrar inbound/outbound real con Baileys y dispatch a webhooks.
4. `Cut 4`: Fases 5 y 6 para exponer API estable y blindar con pruebas.
5. `Cut 5`: Fase 7 para cerrar documentación y dejar handoff limpio.

## Primeros pasos recomendados para arrancar hoy mismo
1. Bloquear por escrito los ADRs mínimos: modular monolith, tenant explícito en contratos internos, una suscripción activa por tenant, media por URL y retry inline simple.
2. Definir el contrato de los cuatro casos de uso principales y los DTOs normalizados de mensaje antes de diseñar la DB.
3. Diseñar el schema inicial incluyendo `provider_connections`; sin eso Baileys y Meta quedan mal modelados desde el inicio.
4. Cortar el primer vertical slice objetivo como `send outbound text/media -> persist message -> response estable`, y después `receive inbound -> persist -> webhook`.
5. Dejar desde el día uno el checklist de smoke test local con tenant seed, webhook echo endpoint y sesión Baileys real.



# FASE 2 - IMPLEMENTAR META

# Plan limpio para integrar Meta WhatsApp Cloud API

## Resumen
Integrar Meta como segundo proveedor real sin tocar dominio ni casos de uso. La implementación debe reutilizar el contrato actual `WhatsAppProvider`, `ReceiveInboundMessageUseCase` y `SendOutboundMessageUseCase`, y agregar solo dos piezas nuevas: un adaptador outbound de Meta y un ingreso HTTP de webhook Meta.

La decisión base es usar **Cloud API por HTTP directo**, no el SDK Node archivado. La configuración operativa queda por tenant en `provider_connections.config`, y para Meta el `connectionKey` será el `phoneNumberId`. Con eso se resuelve outbound, verificación del webhook e inbound multi-tenant sin nuevas tablas.

## Cambios clave
### Proveedor Meta
- Agregar `MetaWhatsAppProvider` que implemente `WhatsAppProvider` y use un `MetaCloudApiClient` interno.
- Registrar el provider en el runtime junto con Baileys; Baileys sigue siendo el único `ProviderRuntime` activo.
- Validar `provider_connections.config` con un esquema dedicado. Config requerida para Meta:
  - `accessToken: string`
  - `verifyToken: string`
  - `appSecret: string`
  - `apiVersion: string`
  - `baseUrl?: string` con default `https://graph.facebook.com`
- Fijar la convención: `provider="meta"` y `connectionKey=<phoneNumberId>`.

### Outbound
- Resolver provider por `providerConnections.findActiveByTenantId` como hoy; si el tenant usa `meta`, `SendOutboundMessageUseCase` no cambia.
- Mapear `MessageContent` actual a Cloud API:
  - `text` -> mensaje `text`
  - `image` -> mensaje `image` por `link`
  - `document` -> mensaje `document` por `link`
- Guardar la respuesta raw de Graph API en `payloadRaw`.
- Normalizar errores HTTP/API de Meta a `ApplicationError(code="provider_send_failed", statusCode=502)` con el detalle real del provider.
- No incluir templates, audio, video, stickers ni status sync en esta fase.

### Webhook Meta
- Exponer `GET /webhooks/meta/:connectionKey` para verificación del webhook.
- Exponer `POST /webhooks/meta/:connectionKey` para eventos inbound.
- Resolver la conexión activa por `provider=meta` + `connectionKey`; agregar un método de repositorio explícito para eso en vez de buscar por JSON config.
- En `GET`, comparar `hub.verify_token` contra `config.verifyToken` y responder `hub.challenge`.
- En `POST`, capturar el **raw body** y validar `X-Hub-Signature-256` usando `config.appSecret`.
- Procesar solo eventos que traigan mensajes inbound de usuario. Ignorar `statuses`, eventos sin `messages` y tipos fuera de `text | image | document` con `200` para no provocar retries innecesarios.
- Verificar que `value.metadata.phone_number_id` coincida con `:connectionKey`; si no coincide, responder `400`.
- Mapear el payload Meta al contrato `InboundProviderMessage` actual y delegar a `ReceiveInboundMessageUseCase`.
- Para media inbound, persistir URL o identificador y metadata disponible del payload; no descargar archivos ni resolver media binaria en esta fase.

### Interfaces y contratos
- Extender el repositorio de `ProviderConnection` con `findActiveByProviderAndConnectionKey(provider, connectionKey)`.
- No cambiar esquema de dominio ni tablas existentes.
- Documentar la forma exacta de `provider_connections.config` para Meta y agregar ejemplo de seed/SQL manual.
- Agregar ejemplos HTTP para el webhook de verificación y para un tenant configurado con Meta.

## Secuencia de implementación
1. Añadir el parser/validator de configuración Meta y el método de repositorio por `provider + connectionKey`.
2. Implementar `MetaCloudApiClient` y `MetaWhatsAppProvider`.
3. Registrar Meta en el provider registry del runtime.
4. Implementar las rutas `GET/POST /webhooks/meta/:connectionKey`.
5. Implementar el validador de firma y el mapper de payload inbound de Meta.
6. Conectar el webhook Meta con `ReceiveInboundMessageUseCase`.
7. Agregar tests y luego documentación operativa.

## Plan de pruebas
- Unitarias:
  - parseo de config Meta válido e inválido
  - mapeo outbound `text/image/document`
  - normalización de errores de Graph API
  - validación de firma `X-Hub-Signature-256`
  - mapeo inbound Meta -> `InboundProviderMessage`
- HTTP:
  - `GET /webhooks/meta/:connectionKey` éxito
  - `GET` con `verify_token` incorrecto
  - `POST` con firma inválida
  - `POST` con `phone_number_id` que no coincide con la ruta
  - `POST` con inbound `text`
  - `POST` con `status` o evento no soportado y respuesta `200`
- Integración manual:
  - tenant con `provider=meta`
  - verificación de webhook en Meta
  - inbound real persistido en contacto/conversación/mensaje
  - outbound real `text`, `image`, `document`
  - dispatch al webhook del tenant después del inbound

## Supuestos y defaults
- Alcance elegido: **full inbound/outbound** para Meta.
- Configuración elegida: `provider_connections.config`.
- No se usará el SDK Node archivado; se usará Cloud API por HTTP directo.
- Una `provider_connection` Meta representa un solo `phoneNumberId`.
- No habrá nueva tabla específica de Meta en esta fase.
- No se implementarán templates, estados de entrega, media download ni sincronización de historial en esta fase.
- Referencias oficiales usadas para esta decisión:
  - Meta-hosted SDK docs: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/
  - Receiving messages: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/receivingMessages/
  - SDK archivado: https://github.com/WhatsApp/WhatsApp-Nodejs-SDK/issues/31
