import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type {
  ProviderMessageTemplateRepository,
  ProviderConnectionRepository,
  ProviderMessageTemplateRecord,
  TenantRepository
} from "../../application/ports/repositories";
import type { DatabaseClient } from "../database/client";
import {
  providerConnectionsTable,
  providerMessageTemplatesTable,
  tenantsTable
} from "../database/schema";

export class PostgresTenantRepository implements TenantRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [tenant] = await this.db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).limit(1);
    return tenant ?? null;
  }
}

export class PostgresProviderConnectionRepository implements ProviderConnectionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [connection] = await this.db
      .select()
      .from(providerConnectionsTable)
      .where(eq(providerConnectionsTable.id, id))
      .limit(1);

    return connection ?? null;
  }

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

export class PostgresProviderMessageTemplateRepository
  implements ProviderMessageTemplateRepository
{
  constructor(private readonly db: DatabaseClient) {}

  async upsert(input: {
    tenantId: string;
    providerConnectionId: string;
    provider: "baileys" | "meta";
    externalTemplateId: string | null;
    providerTemplateName: string;
    languageCode: string;
    category: string;
    status: string;
    lastError: string | null;
    payloadRaw: unknown;
  }): Promise<ProviderMessageTemplateRecord> {
    const [record] = await this.db
      .insert(providerMessageTemplatesTable)
      .values({
        id: randomUUID(),
        tenantId: input.tenantId,
        providerConnectionId: input.providerConnectionId,
        provider: input.provider,
        externalTemplateId: input.externalTemplateId,
        providerTemplateName: input.providerTemplateName,
        languageCode: input.languageCode,
        category: input.category,
        status: input.status,
        lastError: input.lastError,
        payloadRaw: input.payloadRaw,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [
          providerMessageTemplatesTable.providerConnectionId,
          providerMessageTemplatesTable.providerTemplateName,
          providerMessageTemplatesTable.languageCode
        ],
        set: {
          externalTemplateId: input.externalTemplateId,
          category: input.category,
          status: input.status,
          lastError: input.lastError,
          payloadRaw: input.payloadRaw,
          updatedAt: new Date()
        }
      })
      .returning();

    return record;
  }

  async findByExternalTemplateId(providerConnectionId: string, externalTemplateId: string) {
    const [record] = await this.db
      .select()
      .from(providerMessageTemplatesTable)
      .where(
        and(
          eq(providerMessageTemplatesTable.providerConnectionId, providerConnectionId),
          eq(providerMessageTemplatesTable.externalTemplateId, externalTemplateId)
        )
      )
      .limit(1);

    return record ?? null;
  }

  async findByNameAndLanguage(input: {
    providerConnectionId: string;
    providerTemplateName: string;
    languageCode: string;
  }) {
    const [record] = await this.db
      .select()
      .from(providerMessageTemplatesTable)
      .where(
        and(
          eq(providerMessageTemplatesTable.providerConnectionId, input.providerConnectionId),
          eq(providerMessageTemplatesTable.providerTemplateName, input.providerTemplateName),
          eq(providerMessageTemplatesTable.languageCode, input.languageCode)
        )
      )
      .limit(1);

    return record ?? null;
  }
}
