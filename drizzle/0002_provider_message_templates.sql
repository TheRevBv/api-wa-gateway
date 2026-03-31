CREATE TABLE IF NOT EXISTS provider_message_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider_connection_id TEXT NOT NULL REFERENCES provider_connections(id),
  provider TEXT NOT NULL,
  external_template_id TEXT,
  provider_template_name TEXT NOT NULL,
  language_code TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT,
  payload_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_message_templates_connection_name_lang_idx
  ON provider_message_templates (provider_connection_id, provider_template_name, language_code);

CREATE UNIQUE INDEX IF NOT EXISTS provider_message_templates_external_template_idx
  ON provider_message_templates (external_template_id)
  WHERE external_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_message_templates_tenant_idx
  ON provider_message_templates (tenant_id);

CREATE INDEX IF NOT EXISTS provider_message_templates_connection_idx
  ON provider_message_templates (provider_connection_id);
