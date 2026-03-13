# Despliegue

`api-wa-gateway` incluye workflows de GitHub Actions para CI, publicación de imágenes y despliegues manuales a producción sobre una sola VM Linux.

## Flujos de GitHub Actions

- `CI`: corre en cada pull request y en cada push a `main`.
- `Release Image`: corre automáticamente cuando `CI` termina bien en `main` y publica `ghcr.io/therevbv/api-wa-gateway:main` y `ghcr.io/therevbv/api-wa-gateway:sha-<commit>`.
- `Deploy Production`: flujo manual que descarga una etiqueta de imagen en la VM de producción, ejecuta migraciones y reinicia la app.

## Prerrequisitos del host de producción

- VM Linux con Docker Engine y el plugin de Docker Compose instalados.
- `curl` disponible en el host para el health check posterior al deploy.
- Salida a internet desde la VM hacia `ghcr.io`.
- Acceso SSH para el usuario usado por GitHub Actions.
- Directorio de la aplicación creado en `/opt/api-wa-gateway` o en la ruta configurada en `PRODUCTION_APP_DIR`.
- Una instancia de PostgreSQL administrada o externa ya provisionada.

Ejemplo de bootstrap para Ubuntu:

```bash
sudo mkdir -p /opt/api-wa-gateway/baileys-auth
sudo chown -R "$USER":"$USER" /opt/api-wa-gateway
docker --version
docker compose version
curl --version
```

## Archivo de entorno en la VM

Crea `${PRODUCTION_APP_DIR}/.env` en el servidor antes del primer deploy. Si mantienes la ruta por defecto, ese archivo será `/opt/api-wa-gateway/.env`.

Ejemplo:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=8001
LOG_LEVEL=info
DATABASE_URL=postgres://user:password@db-host:5432/api_wa_gateway
WEBHOOK_TIMEOUT_MS=8001
WEBHOOK_RETRY_ATTEMPTS=1
ENABLE_BAILEYS=false
BAILEYS_AUTH_DIR=.baileys-auth
BAILEYS_DASHBOARD_AUTH_TOKEN=
```

Notas:

- `HOST` debe mantenerse en `0.0.0.0`.
- `PORT` controla tanto el puerto interno del contenedor como el puerto publicado en `deploy/compose.production.yml`.
- `BAILEYS_AUTH_DIR` debe seguir siendo compatible con el volumen montado en `/app/.baileys-auth`.
- `APP_DIR` lo resuelve el flujo de deploy y se usa en `deploy/compose.production.yml` tanto para el archivo `.env` como para el volumen persistente de Baileys.

## Configuración de GitHub

Crea un environment de GitHub llamado `production` y agrega estos secrets:

- `PRODUCTION_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_GHCR_USERNAME`
- `PRODUCTION_GHCR_TOKEN`

Agrega estas variables de entorno:

- `PRODUCTION_SSH_PORT=22`
- `PRODUCTION_APP_DIR=/opt/api-wa-gateway`

Protecciones a nivel repositorio:

- Exige el flujo `CI` antes de hacer merge a `main`.
- Exige aprobación del environment `production` antes de que pueda correr el job de deploy.

`PRODUCTION_GHCR_TOKEN` debe ser un token de GitHub o un PAT con `read:packages`.

## Flujo de release

1. Haz push de tus cambios y abre un pull request.
2. Espera a que `CI` pase.
3. Haz merge a `main`.
4. Espera a que `Release Image` publique las etiquetas `main` y `sha-<commit>` en GHCR.
5. Ejecuta `Deploy Production` manualmente y deja `image_tag=main` para desplegar la última release validada.

Qué hace el flujo de deploy:

1. Sube `deploy/compose.production.yml` a la VM.
2. Hace login en GHCR dentro de la VM.
3. Descarga la etiqueta de imagen solicitada.
4. Ejecuta `docker compose -f compose.production.yml run --rm app node dist/scripts/migrate.js`.
5. Ejecuta `docker compose -f compose.production.yml up -d app`.
6. Verifica `http://127.0.0.1:${PORT}/health` dentro de la VM.

Si la migración falla, el flujo se detiene antes de reiniciar el servicio.

## Reversión

1. Abre la ejecución de `Release Image` o el historial del paquete en GHCR e identifica una etiqueta previa `sha-<commit>`.
2. Vuelve a ejecutar `Deploy Production`.
3. Define `image_tag` con el valor anterior `sha-<commit>`.

Esta fase no implementa rollback automático. El rollback sigue siendo manual y basado en imágenes.
