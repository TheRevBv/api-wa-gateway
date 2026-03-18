# Alta de tenant e integración

Esta guía describe el mínimo necesario para dejar un tenant listo para usar el gateway.

## Qué necesita un tenant para operar

Cada tenant requiere como mínimo:

1. un registro en `tenants`;
2. una `provider_connection` activa;
3. opcionalmente, una `webhook_subscription` activa si quieres recibir eventos inbound.

## Valores clave

### `tenant`

- `id`: identificador estable del tenant, por ejemplo `tenant_acme`
- `name`: nombre visible
- `status`: para operar debe ser `active`

### `provider_connection`

- `tenant_id`: tenant al que pertenece
- `provider`: `baileys` o `meta`
- `connection_key`:
  - Baileys: identificador de la sesión
  - Meta: `phone_number_id`
- `status`: para operar debe ser `active`
- `config`: configuración específica del proveedor

### `webhook_subscription`

- `tenant_id`: tenant dueño del webhook
- `callback_url`: URL de tu sistema
- `secret`: secreto opcional para firma HMAC
- `is_active`: debe estar en `true`

## Alta rápida con SQL

El repo ya incluye un script base:

- [add-tenant.sql](/home/therevbv/github/personal/api-wa-gateway/scripts/sql/add-tenant.sql)

Uso:

```bash
psql "$DATABASE_URL" -f scripts/sql/add-tenant.sql
```

Antes de ejecutarlo, ajusta estos valores:

- `tenant_id`
- `tenant_name`
- `webhook_url`
- `webhook_secret`
- `provider`
- `provider_connection_id`
- `connection_key`
- `connection_display_name`

## Recomendación por proveedor

### Baileys

Usa Baileys cuando:

- estás en desarrollo;
- necesitas pruebas rápidas;
- vas a operar una sesión conectada por QR.

Puntos a considerar:

- el tenant solo puede tener una conexión de proveedor activa al mismo tiempo;
- si la sesión no está autenticada, el envío puede responder `provider_auth_required`;
- el QR se opera desde la ruta protegida del dashboard de Baileys.

### Meta Cloud API

Usa Meta cuando:

- quieres una integración orientada a producción;
- ya tienes acceso a WhatsApp Cloud API;
- cuentas con `phone_number_id`, `accessToken`, `verifyToken` y `appSecret`.

Para Meta, `provider_connections.config` debe incluir:

```json
{
  "accessToken": "EAA...",
  "verifyToken": "mi-verify-token",
  "appSecret": "mi-app-secret",
  "apiVersion": "v25.0"
}
```

Además:

- `provider = 'meta'`
- `connection_key = '<PHONE_NUMBER_ID>'`

El repo incluye un SQL de apoyo:

- [add-meta-provider-demo.sql](/home/therevbv/github/personal/api-wa-gateway/scripts/sql/add-meta-provider-demo.sql)

## Checklist de onboarding

- `tenants.status = 'active'`
- existe una `provider_connection` activa para el tenant
- existe como máximo una `provider_connection` activa por tenant
- si habrá callbacks, existe una `webhook_subscription` activa
- si hay `secret`, el sistema receptor ya valida HMAC-SHA256
- si usas Meta, el `verifyToken` y `appSecret` ya están correctos
- si usas Baileys, la sesión ya fue autenticada

## Cómo validar que quedó listo

### 1. Health

```bash
curl http://localhost:8001/health
```

### 2. Envío de prueba

```bash
curl -X POST http://localhost:8001/api/v1/tenants/tenant_acme/messages \
  -H "content-type: application/json" \
  -d '{
    "to": "5215512345678",
    "content": {
      "type": "text",
      "text": "mensaje de prueba"
    }
  }'
```

### 3. Validar webhook

Envía un mensaje inbound al número conectado y confirma:

- que se guarda en `messages`;
- que existe o se actualiza una `conversation`;
- que tu sistema recibe el webhook `message.received`.

## Observaciones operativas

- El gateway no incluye panel administrativo para alta de tenants en esta fase.
- El onboarding es principalmente operativo y por configuración.
- Si vas a exponer la API a terceros, añade autenticación y control de acceso fuera del gateway.
