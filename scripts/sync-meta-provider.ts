import "dotenv/config";

import { and, eq, ne } from "drizzle-orm";

import { loadEnvironment } from "../src/config/env";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { providerConnectionsTable, tenantsTable } from "../src/infrastructure/database/schema";

const run = async (): Promise<void> => {
  const env = loadEnvironment();
  const connection = createDatabaseConnection(env.DATABASE_URL);
  const warnings: string[] = [];

  if (!env.META_PHONE_NUMBER_ID) {
    throw new Error("META_PHONE_NUMBER_ID is required to sync the Meta provider connection");
  }

  if (!env.META_ACCESS_TOKEN) {
    throw new Error("META_ACCESS_TOKEN is required to sync the Meta provider connection");
  }

  if (!env.META_VERIFY_TOKEN) {
    warnings.push("META_VERIFY_TOKEN is empty. GET /webhooks/meta/:connectionKey will fail until you set it.");
  }

  if (!env.META_APP_SECRET) {
    warnings.push("META_APP_SECRET is empty. POST /webhooks/meta/:connectionKey will fail signature validation until you set it.");
  }

  try {
    const [tenant] = await connection.db
      .select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, env.META_TENANT_ID))
      .limit(1);

    if (!tenant) {
      throw new Error(
        `Tenant ${env.META_TENANT_ID} was not found. Create it first with pnpm db:seed or scripts/sql/add-tenant.sql.`
      );
    }

    const [existingMetaConnection] = await connection.db
      .select({ id: providerConnectionsTable.id })
      .from(providerConnectionsTable)
      .where(
        and(
          eq(providerConnectionsTable.tenantId, env.META_TENANT_ID),
          eq(providerConnectionsTable.provider, "meta")
        )
      )
      .limit(1);

    const providerConnectionId = existingMetaConnection?.id ?? env.META_PROVIDER_CONNECTION_ID;
    const providerConfig: Record<string, unknown> = {
      accessToken: env.META_ACCESS_TOKEN,
      apiVersion: env.META_API_VERSION,
      baseUrl: env.META_BASE_URL
    };

    if (env.META_VERIFY_TOKEN) {
      providerConfig.verifyToken = env.META_VERIFY_TOKEN;
    }

    if (env.META_APP_SECRET) {
      providerConfig.appSecret = env.META_APP_SECRET;
    }

    await connection.db.transaction(async (tx) => {
      if (env.META_ACTIVATE) {
        await tx
          .update(providerConnectionsTable)
          .set({
            status: "inactive",
            updatedAt: new Date()
          })
          .where(
            and(
              eq(providerConnectionsTable.tenantId, env.META_TENANT_ID),
              ne(providerConnectionsTable.id, providerConnectionId),
              eq(providerConnectionsTable.status, "active")
            )
          );
      }

      await tx
        .insert(providerConnectionsTable)
        .values({
          id: providerConnectionId,
          tenantId: env.META_TENANT_ID,
          provider: "meta",
          connectionKey: env.META_PHONE_NUMBER_ID,
          displayName: env.META_PROVIDER_DISPLAY_NAME,
          status: env.META_ACTIVATE ? "active" : "inactive",
          config: providerConfig,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [providerConnectionsTable.tenantId, providerConnectionsTable.provider],
          set: {
            connectionKey: env.META_PHONE_NUMBER_ID,
            displayName: env.META_PROVIDER_DISPLAY_NAME,
            status: env.META_ACTIVATE ? "active" : "inactive",
            config: providerConfig,
            updatedAt: new Date()
          }
        });
    });

    console.log(`Meta provider synced for tenant ${tenant.id} (${tenant.name})`);
    console.log(`Provider connection ID: ${providerConnectionId}`);
    console.log(`Phone number ID / connection key: ${env.META_PHONE_NUMBER_ID}`);
    console.log(`Status: ${env.META_ACTIVATE ? "active" : "inactive"}`);

    if (warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }
  } finally {
    await connection.pool.end();
  }
};

void run();
