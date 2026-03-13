# ADR 0002: Resolución de tenant a través del contexto de la conexión del proveedor

## Estado

Aprobado

## Decisión

Los mensajes inbound se procesan con un `tenantId` explícito inyectado por el adaptador del proveedor a partir de la `provider_connection` activa.

## Por qué

- Baileys no entrega la identidad del tenant de forma directa.
- El gateway debe mantener conciencia de tenant sin heurísticas basadas en payloads de negocio.
- Esto mantiene la capa de aplicación independiente de detalles de sesión específicos del proveedor.

## Consecuencias

- Cada conexión activa de proveedor pertenece a un solo tenant.
- El procesamiento inbound depende de una configuración correcta de `provider_connection`.
- Meta puede reutilizar después el mismo contrato interno.
