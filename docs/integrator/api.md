# Referencia API para integradores

## Base URL

La URL base depende del ambiente:

- local: `http://localhost:8001`
- desarrollo, staging o producción: la que te entregue el equipo operador

## Convenciones generales

- Formato de solicitud: `application/json`
- Formato de respuesta: `application/json`, excepto la verificación de Meta que responde `text/plain`
- Fechas: ISO 8601 en UTC
- Paginación: `limit` y `offset`
- Alcance por tenant: la API pública usa `tenantId` en la ruta

## Verificación de salud

### `GET /health`

Valida que la instancia está arriba.

Respuesta `200`:

```json
{
  "status": "ok"
}
```

## Enviar mensaje outbound

### `POST /api/v1/tenants/:tenantId/messages`

Envía un mensaje outbound por la conexión de proveedor activa del tenant.

### Parámetros de ruta

- `tenantId`: identificador del tenant

### Cuerpo de la solicitud

#### Texto

```json
{
  "to": "5215512345678",
  "content": {
    "type": "text",
    "text": "hola desde mi sistema"
  }
}
```

#### Imagen

```json
{
  "to": "5215512345678",
  "content": {
    "type": "image",
    "mediaUrl": "https://example.com/sample.jpg",
    "mimeType": "image/jpeg",
    "caption": "imagen de prueba",
    "fileName": "sample.jpg"
  }
}
```

#### Documento

```json
{
  "to": "5215512345678",
  "content": {
    "type": "document",
    "mediaUrl": "https://example.com/sample.pdf",
    "mimeType": "application/pdf",
    "caption": "documento de prueba",
    "fileName": "sample.pdf"
  }
}
```

### Respuesta `201`

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

### Respuestas de error esperadas

- `400`: solicitud inválida
- `404`: tenant inexistente o inactivo
- `409`: no hay conexión de proveedor activa o el proveedor requiere autenticación adicional
- `502`: el proveedor rechazó el mensaje
- `503`: el proveedor no está disponible para enviar en ese momento

## Listar conversaciones

### `GET /api/v1/tenants/:tenantId/conversations`

### Parámetros de consulta

- `limit`: entero entre `1` y `100`, por defecto `20`
- `offset`: entero mayor o igual a `0`, por defecto `0`

### Respuesta `200`

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

## Obtener una conversación

### `GET /api/v1/tenants/:tenantId/conversations/:conversationId`

### Respuesta `200`

```json
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
```

### Respuestas de error esperadas

- `400`: parámetros inválidos
- `404`: conversación inexistente o fuera del tenant

## Listar mensajes de una conversación

### `GET /api/v1/tenants/:tenantId/conversations/:conversationId/messages`

### Parámetros de consulta

- `limit`: entero entre `1` y `100`, por defecto `20`
- `offset`: entero mayor o igual a `0`, por defecto `0`

### Respuesta `200`

```json
{
  "items": [
    {
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
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### Respuestas de error esperadas

- `400`: parámetros inválidos
- `404`: tenant no disponible o conversación inexistente

## Endpoints de Meta expuestos por el gateway

Estos endpoints no los consume el sistema integrador general; los usa Meta para entregar eventos al gateway:

- `GET /webhooks/meta/:connectionKey`
- `POST /webhooks/meta/:connectionKey`

Si vas a operar la integración con Meta, revisa también [tenant-onboarding.md](/home/therevbv/github/personal/api-wa-gateway/docs/integrator/tenant-onboarding.md).

## Colección lista para pruebas

Puedes usar la colección Postman del repo:

- [api-wa-gateway.postman_collection.json](/home/therevbv/github/personal/api-wa-gateway/docs/postman/api-wa-gateway.postman_collection.json)

Y el contrato OpenAPI:

- [api-wa-gateway.openapi.json](/home/therevbv/github/personal/api-wa-gateway/docs/openapi/api-wa-gateway.openapi.json)
