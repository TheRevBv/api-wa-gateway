-- Usage:
--   p
--
-- This script adds or updates a Meta provider connection with placeholder/test values.
-- It leaves the Meta connection inactive by default so it can coexist with an active Baileys connection.
-- Replace the placeholder values before switching this provider to active.

\set tenant_id 'tenant_demo'
\set provider_connection_id 'meta_demo_connection'
\set connection_key '123456789012345'
\set connection_display_name 'Demo Meta Cloud API'
\set access_token 'meta-test-access-token'
\set verify_token 'meta-test-verify-token'
\set app_secret 'meta-test-app-secret'
\set api_version 'v23.0'

BEGIN;

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
  'meta',
  :'connection_key',
  :'connection_display_name',
  'inactive',
  jsonb_build_object(
    'accessToken', :'access_token',
    'verifyToken', :'verify_token',
    'appSecret', :'app_secret',
    'apiVersion', :'api_version',
    'seeded_via', 'manual_sql',
    'note', 'Replace these placeholder values with real Meta Cloud API credentials before activating this provider'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, provider) DO UPDATE
SET
  connection_key = EXCLUDED.connection_key,
  display_name = EXCLUDED.display_name,
  status = 'inactive',
  config = EXCLUDED.config,
  updated_at = NOW();

COMMIT;
