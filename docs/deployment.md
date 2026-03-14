# Despliegue

`api-wa-gateway` incluye workflows de GitHub Actions para CI, publicación de imágenes y despliegues reutilizables a entornos `dev` y `production` sobre una VM Linux.

## Flujos de GitHub Actions

- `CI`: corre en cada pull request.
- `Build & Push (GHCR)`: corre en `main`, `develop` y tags `v*.*.*`; valida, ejecuta migraciones y publica `ghcr.io/therevbv/api-wa-gateway`.
- `Deploy Reusable`: workflow interno reutilizable que concentra la lógica SSH, copy, pull, migración, `up -d` y health check.
- `Deploy Dev`: wrapper para el entorno `dev`; puede ejecutarse manualmente y también se invoca automáticamente desde `Build & Push (GHCR)` cuando el branch es `develop`.
- `Deploy Production`: wrapper manual para `production`.

## Prerrequisitos del host remoto

- VM Linux con Docker Engine y el plugin de Docker Compose instalados.
- `curl` disponible en el host para el health check posterior al deploy.
- Salida a internet desde la VM hacia `ghcr.io`.
- Acceso SSH para el usuario usado por GitHub Actions.
- Directorio de la aplicación creado en la ruta configurada para cada entorno.
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

Crea el archivo de entorno del host antes del primer deploy.

Ejemplos típicos:

- `production`: `/opt/api-wa-gateway/.env`
- `dev`: `/opt/api-wa-gateway-dev/.env`

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
- `APP_ENV_FILE` y `APP_DIR` los exporta el flujo reusable de deploy para que `deploy/compose.production.yml` pueda resolver el archivo `.env` y el volumen persistente.

## Configuración de GitHub

Crea estos secrets a nivel repositorio:

- `DEV_HOST`
- `DEV_SSH_USER`
- `DEV_SSH_PRIVATE_KEY`
- `DEV_GHCR_TOKEN`
- `DEV_GHCR_USERNAME`
- `PRODUCTION_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_GHCR_USERNAME`
- `PRODUCTION_GHCR_TOKEN`

Agrega estas variables a nivel repositorio:

- `DEV_APP_DIR=/opt/api-wa-gateway-dev`
- `DEV_SSH_PORT=22`
- `DEV_REMOTE_ENV_FILE=/opt/api-wa-gateway-dev/.env`
- `DEV_HEALTHCHECK_URL=http://127.0.0.1:8001/health`
- `PRODUCTION_SSH_PORT=22`
- `PRODUCTION_APP_DIR=/opt/api-wa-gateway`
- `PRODUCTION_REMOTE_ENV_FILE=/opt/api-wa-gateway/.env`
- `PRODUCTION_HEALTHCHECK_URL=http://127.0.0.1:8001/health`

Crea estos environments de GitHub:

- `dev`
- `production`

Protecciones a nivel repositorio:

- Exige el flujo `CI` antes de hacer merge a `main`.
- Exige aprobación del environment `production` antes de que pueda correr el job de deploy.

`DEV_GHCR_TOKEN` y `PRODUCTION_GHCR_TOKEN` deben ser tokens de GitHub o PATs con `read:packages`.

## Flujo de release

1. Haz push de tus cambios y abre un pull request.
2. Espera a que `CI` pase.
3. Haz merge a `main`.
4. Cuando el push cae en `main`, `Build & Push (GHCR)` publicará al menos `main`, `latest` y `sha-<commit>` en GHCR.
5. Cuando el push cae en `develop`, `Build & Push (GHCR)` publicará `develop` y luego llamará automáticamente a `Deploy Reusable` para desplegar `dev`.
6. Para producción, ejecuta `Deploy Production` manualmente y deja `image_tag=main` o usa una etiqueta `sha-<commit>` o `v*.*.*` si quieres fijar una release.

Qué hace el flujo reusable de deploy:

1. Sube `deploy/compose.production.yml` a la VM.
2. Hace login en GHCR dentro de la VM.
3. Descarga la etiqueta de imagen solicitada.
4. Ejecuta `docker compose --env-file <env> -f <compose> run --rm app node dist/scripts/migrate.js`.
5. Ejecuta `docker compose --env-file <env> -f <compose> up -d --remove-orphans app`.
6. Verifica la URL configurada en `*_HEALTHCHECK_URL`.

Si la migración falla, el flujo se detiene antes de reiniciar el servicio.

## Reversión

1. Abre la ejecución de `Build & Push (GHCR)` o el historial del paquete en GHCR e identifica una etiqueta previa `sha-<commit>`.
2. Vuelve a ejecutar `Deploy Production`.
3. Define `image_tag` con el valor anterior `sha-<commit>`.

Esta fase no implementa rollback automático. El rollback sigue siendo manual y basado en imágenes.
