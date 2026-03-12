-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/add-tenant.sql
--
-- Edit the values below before running the script.

\set tenant_id 'tenant_acme'
\set tenant_name 'Acme Tenant'
\set webhook_id 'webhook_acme'
\set webhook_url 'http://localhost:9999/webhook'
\set webhook_secret 'change-me'
\set provider 'baileys'
\set provider_connection_id 'provider_connection_acme'
\set connection_key 'acme-baileys-session'
\set connection_display_name 'Acme Baileys Session'

BEGIN;

INSERT INTO tenants (
  id,
  name,
  status,
  created_at,
  updated_at
)
VALUES (
  :'tenant_id',
  :'tenant_name',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = NOW();

UPDATE webhook_subscriptions
SET
  is_active = FALSE,
  updated_at = NOW()
WHERE tenant_id = :'tenant_id';

INSERT INTO webhook_subscriptions (
  id,
  tenant_id,
  callback_url,
  secret,
  is_active,
  created_at,
  updated_at
)
VALUES (
  :'webhook_id',
  :'tenant_id',
  :'webhook_url',
  :'webhook_secret',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  callback_url = EXCLUDED.callback_url,
  secret = EXCLUDED.secret,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO provider_connections (
  id,
  tenant_id,
  provider,
  connection_key,
  display_name,
  status,
  config,
  created_at,
  updated_at
)
VALUES (
  :'provider_connection_id',
  :'tenant_id',
  :'provider',
  :'connection_key',
  :'connection_display_name',
  'active',
  jsonb_build_object(
    'seeded_via', 'manual_sql',
    'note', 'Update this config for the real provider session if needed'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  connection_key = EXCLUDED.connection_key,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  config = EXCLUDED.config,
  updated_at = NOW();

COMMIT;
