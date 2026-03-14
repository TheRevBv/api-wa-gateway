# Errores y manejo recomendado

## Formato general

Cuando la API devuelve error, responde con esta forma:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": {}
  }
}
```

`details` solo aparece en errores de validación.

## Errores HTTP comunes para integradores

### `400 Bad Request`

Se usa cuando:

- el cuerpo no es JSON válido;
- faltan campos obligatorios;
- el `tenantId`, `conversationId`, `limit` o `offset` son inválidos;
- el payload de Meta recibido por el gateway es inválido.

Códigos frecuentes:

- `invalid_json_body`
- `validation_error`
- `meta_webhook_payload_invalid`
- `meta_webhook_connection_mismatch`

Qué hacer:

- revisa el cuerpo, los parámetros de consulta y los parámetros de ruta;
- no reintentes sin corregir la solicitud.

### `401 Unauthorized`

Se usa hoy en el flujo inbound de Meta cuando la firma del webhook es inválida o falta.

Códigos frecuentes:

- `meta_webhook_signature_invalid`

Qué hacer:

- valida el secreto configurado;
- asegúrate de firmar y verificar sobre el cuerpo crudo cuando aplique.

### `403 Forbidden`

Se usa en la verificación del webhook de Meta.

Códigos frecuentes:

- `meta_webhook_verification_failed`

Qué hacer:

- revisa `verifyToken` y `connectionKey`.

### `404 Not Found`

Se usa cuando el recurso no existe o no está disponible para el tenant.

Códigos frecuentes:

- `tenant_not_available`
- `conversation_not_found`
- `contact_not_found`
- `provider_connection_not_found`

Qué hacer:

- confirma que el tenant esté activo;
- confirma que el `conversationId` pertenezca al tenant;
- confirma que exista una conexión activa del proveedor.

### `409 Conflict`

Se usa cuando el tenant no puede enviar por su configuración o estado actual.

Códigos frecuentes:

- `provider_connection_not_found`
- `provider_auth_required`

Qué hacer:

- verifica que el tenant tenga una conexión activa;
- si usas Baileys, asegúrate de haber escaneado el QR.

### `502 Bad Gateway`

Se usa cuando el proveedor rechaza el envío.

Códigos frecuentes:

- `provider_send_failed`

Qué hacer:

- revisa el contenido enviado;
- valida formato de teléfono y media URL;
- revisa credenciales o restricciones del proveedor.

### `503 Service Unavailable`

Se usa cuando el proveedor no está listo para enviar.

Códigos frecuentes:

- `provider_unavailable`
- `provider_disabled`
- `provider_not_configured`

Qué hacer:

- reintenta después;
- revisa estado de sesión o configuración del proveedor.

### `500 Internal Server Error`

Códigos frecuentes:

- `internal_server_error`

Qué hacer:

- registra el error;
- no asumas éxito;
- reintenta solo si tu operación es idempotente y tiene sentido funcional.

## Tabla resumida

| HTTP | code | Significado |
| --- | --- | --- |
| 400 | `invalid_json_body` | El cuerpo no es JSON válido |
| 400 | `validation_error` | La solicitud no cumple el esquema esperado |
| 404 | `tenant_not_available` | El tenant no existe o no está activo |
| 404 | `conversation_not_found` | La conversación no existe o no pertenece al tenant |
| 404 | `provider_connection_not_found` | No existe conexión de proveedor activa |
| 409 | `provider_auth_required` | Baileys requiere escaneo de QR |
| 502 | `provider_send_failed` | El proveedor rechazó el mensaje |
| 503 | `provider_unavailable` | El proveedor no está listo para enviar |
| 500 | `internal_server_error` | Error inesperado del servidor |

## Recomendaciones de manejo en cliente

- Trata `400` como error corregible por solicitud.
- Trata `404` como error funcional o de configuración.
- Trata `409` como error de estado del tenant o del proveedor.
- Trata `502` y `503` como errores transitorios o dependientes del proveedor.
- Loggea siempre `error.code`, `error.message`, `tenantId` y el endpoint invocado.
