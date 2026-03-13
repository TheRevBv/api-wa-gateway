# Webhooks para integradores

El gateway puede enviar eventos HTTP a tu sistema cuando recibe mensajes inbound desde WhatsApp.

## Cuándo se dispara

Hoy existe un evento funcional público para integradores:

- `message.received`

Ese evento se dispara cuando el gateway:

1. identifica el tenant;
2. persiste el mensaje inbound;
3. resuelve una `webhook_subscription` activa para ese tenant.

Si no hay webhook activo para el tenant, el mensaje se guarda pero no se envía ningún callback.

## Método, headers y firma

### Método HTTP

- `POST`

### Headers enviados

- `content-type: application/json`
- `x-api-wa-gateway-event: message.received`
- `x-api-wa-gateway-signature: <hex>` solo si la suscripción tiene `secret`

## Cómo validar la firma

Si el webhook del tenant tiene `secret`, el gateway firma el cuerpo serializado con:

- algoritmo: `HMAC-SHA256`
- payload firmado: el JSON exacto enviado en el cuerpo
- salida: hash hexadecimal

Fórmula conceptual:

```text
signature = HMAC_SHA256(secret, raw_request_body_json)
```

Tu sistema debe calcular el hash sobre el cuerpo crudo y compararlo con el encabezado:

```text
x-api-wa-gateway-signature
```

## Payload del evento `message.received`

```json
{
  "event": "message.received",
  "occurredAt": "2026-03-13T18:20:15.000Z",
  "tenant": {
    "id": "tenant_acme",
    "name": "Acme Tenant"
  },
  "conversation": {
    "id": "cnv_01jabc123",
    "channel": "whatsapp",
    "status": "active",
    "startedAt": "2026-03-13T18:10:00.000Z",
    "lastMessageAt": "2026-03-13T18:20:15.000Z"
  },
  "contact": {
    "id": "cnt_01jabc123",
    "phone": "5215512345678",
    "displayName": "Juan Perez",
    "providerContactId": "5215512345678"
  },
  "message": {
    "id": "msg_01jabc999",
    "provider": "meta",
    "providerMessageId": "wamid.HBgLM...",
    "direction": "inbound",
    "type": "text",
    "body": "hola, necesito ayuda",
    "media": null,
    "status": "received",
    "sentAt": null,
    "receivedAt": "2026-03-13T18:20:15.000Z",
    "createdAt": "2026-03-13T18:20:15.000Z"
  }
}
```

## Ejemplo con media

```json
{
  "event": "message.received",
  "occurredAt": "2026-03-13T18:25:00.000Z",
  "tenant": {
    "id": "tenant_acme",
    "name": "Acme Tenant"
  },
  "conversation": {
    "id": "cnv_01jabc123",
    "channel": "whatsapp",
    "status": "active",
    "startedAt": "2026-03-13T18:10:00.000Z",
    "lastMessageAt": "2026-03-13T18:25:00.000Z"
  },
  "contact": {
    "id": "cnt_01jabc123",
    "phone": "5215512345678",
    "displayName": "Juan Perez",
    "providerContactId": "5215512345678"
  },
  "message": {
    "id": "msg_01jabd001",
    "provider": "meta",
    "providerMessageId": "wamid.HBgLP...",
    "direction": "inbound",
    "type": "image",
    "body": "foto de producto",
    "media": {
      "providerMediaId": "1234567890",
      "mimeType": "image/jpeg",
      "caption": "foto de producto"
    },
    "status": "received",
    "sentAt": null,
    "receivedAt": "2026-03-13T18:25:00.000Z",
    "createdAt": "2026-03-13T18:25:00.000Z"
  }
}
```

## Qué debe responder tu webhook

Responde un código `2xx` tan pronto como aceptes el evento.

Recomendación práctica:

- valida firma;
- registra el evento;
- encola o procesa de forma asíncrona;
- responde `200` o `202` rápido.

## Reintentos y timeouts

El gateway reintenta si:

- el webhook responde un código no `2xx`;
- ocurre timeout;
- ocurre error de red;
- tu endpoint no responde a tiempo.

En la configuración actual del proyecto:

- `WEBHOOK_TIMEOUT_MS` controla el timeout por intento;
- `WEBHOOK_RETRY_ATTEMPTS` controla los reintentos adicionales.

En el `.env.example` del repo el valor actual es:

- `WEBHOOK_TIMEOUT_MS=8001`
- `WEBHOOK_RETRY_ATTEMPTS=1`

Eso equivale a 1 intento inicial y 1 reintento adicional.

## Qué registra el gateway

Por cada dispatch se guarda:

- payload enviado;
- status final;
- código HTTP de respuesta;
- cuerpo de respuesta;
- error de red o timeout, si ocurre;
- número de intentos.

## Recomendaciones para el integrador

- Usa un endpoint idempotente.
- Valida la firma si se configuró `secret`.
- No dependas del orden absoluto entre eventos si tu sistema hace procesamiento asíncrono.
- Tolera reintentos del mismo evento.
- Registra `message.id`, `message.providerMessageId` y `conversation.id`.
