CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  connection_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_connections_tenant_provider_unique UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  phone TEXT NOT NULL,
  display_name TEXT,
  provider_contact_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contacts_tenant_phone_unique UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_tenant_contact_channel_unique UNIQUE (tenant_id, contact_id, channel)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  direction TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT,
  media JSONB,
  payload_raw JSONB NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_tenant_provider_provider_message_idx
  ON messages (tenant_id, provider, provider_message_id);

CREATE INDEX IF NOT EXISTS messages_conversation_created_at_idx
  ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  callback_url TEXT NOT NULL,
  secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_tenant_active_idx
  ON webhook_subscriptions (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS webhook_dispatches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id TEXT NOT NULL REFERENCES messages(id),
  subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id),
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  status TEXT NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_dispatches_tenant_created_at_idx
  ON webhook_dispatches (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS contacts_tenant_id_idx
  ON contacts (tenant_id);

CREATE INDEX IF NOT EXISTS conversations_tenant_last_message_idx
  ON conversations (tenant_id, last_message_at DESC);
