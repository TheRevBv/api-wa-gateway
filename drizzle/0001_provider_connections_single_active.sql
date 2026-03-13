CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_tenant_active_idx
ON provider_connections (tenant_id)
WHERE status = 'active';
