# Inicio rápido para integradores

Esta guía está dirigida a equipos que consumirán `api-wa-gateway` desde otro sistema para:

- enviar mensajes de WhatsApp;
- consultar conversaciones y mensajes;
- recibir eventos inbound mediante webhook.

## Qué necesitas

- La URL base del ambiente, por ejemplo: `https://gateway.midominio.com`
- Un `tenantId` activo, por ejemplo: `tenant_acme`
- Al menos una `provider_connection` activa para ese tenant
- Un `webhook_subscription` activo si quieres recibir eventos inbound

## Importante sobre autenticación

La API HTTP pública del gateway valida `Authorization: Bearer <token>` cuando `GATEWAY_PUBLIC_API_BEARER_TOKEN` está configurado.

En producción, ese token es obligatorio. En desarrollo o pruebas locales puede dejarse vacío para mantener el flujo simple.

Además del bearer, sigue siendo recomendable exponer el gateway detrás de controles perimetrales como:

- red privada;
- VPN;
- reverse proxy con autenticación;
- API gateway externo;
- reglas de firewall por IP.

## Flujo mínimo recomendado

1. Confirma conectividad con `GET /health`
2. Envía un mensaje outbound con `POST /api/v1/tenants/:tenantId/messages`
3. Consulta la conversación creada o reutilizada con `GET /api/v1/tenants/:tenantId/conversations`
4. Configura un webhook por tenant para recibir eventos `message.received`

## Paso 1: validar que el gateway está disponible

```bash
curl https://gateway.midominio.com/health
```

Respuesta esperada:

```json
{
  "status": "ok"
}
```

## Paso 2: enviar un mensaje de texto

```bash
curl -X POST https://gateway.midominio.com/api/v1/tenants/tenant_acme/messages \
  -H "Authorization: Bearer <GATEWAY_PUBLIC_API_BEARER_TOKEN>" \
  -H "content-type: application/json" \
  -d '{
    "to": "5215512345678",
    "content": {
      "type": "text",
      "text": "hola desde mi sistema",
      "previewUrl": true
    }
  }'
```

Respuesta esperada `201 Created`:

```json
{
  "contact": {
    "id": "cnt_01jabc123",
    "tenantId": "tenant_acme",
    "phone": "5215512345678",
    "displayName": null,
    "providerContactId": null,
    "createdAt": "2026-03-13T18:10:00.000Z",
    "updatedAt": "2026-03-13T18:10:00.000Z"
  },
  "conversation": {
    "id": "cnv_01jabc123",
    "tenantId": "tenant_acme",
    "contactId": "cnt_01jabc123",
    "channel": "whatsapp",
    "status": "active",
    "startedAt": "2026-03-13T18:10:00.000Z",
    "lastMessageAt": "2026-03-13T18:10:01.000Z",
    "createdAt": "2026-03-13T18:10:00.000Z",
    "updatedAt": "2026-03-13T18:10:00.000Z"
  },
  "message": {
    "id": "msg_01jabc123",
    "tenantId": "tenant_acme",
    "conversationId": "cnv_01jabc123",
    "contactId": "cnt_01jabc123",
    "provider": "meta",
    "providerMessageId": "wamid.HBgLN...",
    "direction": "outbound",
    "type": "text",
    "body": "hola desde mi sistema",
    "media": null,
    "status": "sent",
    "sentAt": "2026-03-13T18:10:01.000Z",
    "receivedAt": null,
    "createdAt": "2026-03-13T18:10:01.000Z"
  }
}
```

## Paso 3: listar conversaciones

```bash
curl "https://gateway.midominio.com/api/v1/tenants/tenant_acme/conversations?limit=20&offset=0" \
  -H "Authorization: Bearer <GATEWAY_PUBLIC_API_BEARER_TOKEN>"
```

Respuesta esperada `200 OK`:

```json
{
  "items": [
    {
      "conversation": {
        "id": "cnv_01jabc123",
        "tenantId": "tenant_acme",
        "contactId": "cnt_01jabc123",
        "channel": "whatsapp",
        "status": "active",
        "startedAt": "2026-03-13T18:10:00.000Z",
        "lastMessageAt": "2026-03-13T18:10:01.000Z",
        "createdAt": "2026-03-13T18:10:00.000Z",
        "updatedAt": "2026-03-13T18:10:00.000Z"
      },
      "contact": {
        "id": "cnt_01jabc123",
        "tenantId": "tenant_acme",
        "phone": "5215512345678",
        "displayName": null,
        "providerContactId": null,
        "createdAt": "2026-03-13T18:10:00.000Z",
        "updatedAt": "2026-03-13T18:10:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

## Paso 4: consultar mensajes de una conversación

```bash
curl "https://gateway.midominio.com/api/v1/tenants/tenant_acme/conversations/cnv_01jabc123/messages?limit=50&offset=0" \
  -H "Authorization: Bearer <GATEWAY_PUBLIC_API_BEARER_TOKEN>"
```

## Tipos de mensaje soportados

En esta fase, el gateway soporta estos tipos outbound:

- `text`
- `image`
- `document`
- `template`

Si usas Meta Cloud API en entorno de prueba, normalmente conviene probar primero con un template aprobado como `hello_world`.

## Qué pasa cuando entra un mensaje inbound

Cuando el proveedor entrega un mensaje inbound al gateway:

1. se resuelve el tenant;
2. se encuentra o crea el contacto;
3. se encuentra o crea la conversación;
4. se persiste el mensaje;
5. si existe un webhook activo para el tenant, se envía un evento `message.received` a tu sistema.

La estructura exacta de ese evento está documentada en [webhooks.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/webhooks.md).

## Siguiente lectura

- Referencia de endpoints: [api.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/api.md)
- Contrato de webhooks: [webhooks.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/webhooks.md)
- Errores y manejo recomendado: [errors.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/errors.md)
- Alta de tenant e integración: [tenant-onboarding.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/tenant-onboarding.md)
