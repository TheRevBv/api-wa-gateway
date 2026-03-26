import { and, eq } from "drizzle-orm";

import type {
  ProviderConnectionRepository,
  TenantRepository
} from "../../application/ports/repositories";
import type { DatabaseClient } from "../database/client";
import { providerConnectionsTable, tenantsTable } from "../database/schema";

export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [tenant] = await this.db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).limit(1);
    return tenant ?? null;
  }
}

export class PostgresProviderConnectionRepository implements ProviderConnectionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findActiveByTenantId(tenantId: string) {
    const [connection] = await this.db
      .select()
      .from(providerConnectionsTable)
      .where(and(eq(providerConnectionsTable.tenantId, tenantId), eq(providerConnectionsTable.status, "active")))
      .limit(1);

    return connection ?? null;
  }

  async findActiveByTenantIdAndProvider(tenantId: string, provider: "baileys" | "meta") {
    const [connection] = await this.db
      .select()
      .from(providerConnectionsTable)
      .where(
        and(
          eq(providerConnectionsTable.tenantId, tenantId),
          eq(providerConnectionsTable.provider, provider),
          eq(providerConnectionsTable.status, "active")
        )
      )
      .limit(1);

    return connection ?? null;
  }

  async findActiveByProviderAndConnectionKey(provider: "baileys" | "meta", connectionKey: string) {
    const [connection] = await this.db
      .select()
      .from(providerConnectionsTable)
      .where(
        and(
          eq(providerConnectionsTable.provider, provider),
          eq(providerConnectionsTable.connectionKey, connectionKey),
          eq(providerConnectionsTable.status, "active")
        )
      )
      .limit(1);

    return connection ?? null;
  }

  async listActiveByProvider(provider: "baileys" | "meta") {
    return this.db
      .select()
      .from(providerConnectionsTable)
      .where(and(eq(providerConnectionsTable.provider, provider), eq(providerConnectionsTable.status, "active")));
  }
}
