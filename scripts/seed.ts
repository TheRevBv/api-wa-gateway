import "dotenv/config";

import { createId } from "../src/application/services/id";
import { loadEnvironment } from "../src/config/env";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import {
  providerConnectionsTable,
  tenantsTable,
  webhookSubscriptionsTable
} from "../src/infrastructure/database/schema";

const DEMO_TENANT_ID = "tenant_demo";
const DEMO_WEBHOOK_ID = "webhook_demo";
const DEMO_PROVIDER_CONNECTION_ID = "provider_connection_demo";

const run = async (): Promise<void> => {
  const env = loadEnvironment();
  const connection = createDatabaseConnection(env.DATABASE_URL);
  const now = new Date();

  try {
    await connection.db
      .insert(tenantsTable)
      .values({
        id: DEMO_TENANT_ID,
        name: "Demo Tenant",
        status: "active",
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();

    await connection.db
      .insert(webhookSubscriptionsTable)
      .values({
        id: DEMO_WEBHOOK_ID,
        tenantId: DEMO_TENANT_ID,
        callbackUrl: "http://localhost:9999/webhook",
        secret: "demo-secret",
        isActive: true,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();

    await connection.db
      .insert(providerConnectionsTable)
      .values({
        id: DEMO_PROVIDER_CONNECTION_ID,
        tenantId: DEMO_TENANT_ID,
        provider: "baileys",
        connectionKey: "demo-baileys-session",
        displayName: "Demo Baileys Session",
        status: "active",
        config: {
          note: "Update this seed with your real session metadata if needed",
          seededAt: now.toISOString(),
          installReference: createId()
        },
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();

    console.log("Seed completed");
    console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
    console.log(`Webhook ID: ${DEMO_WEBHOOK_ID}`);
    console.log(`Provider connection ID: ${DEMO_PROVIDER_CONNECTION_ID}`);
  } finally {
    await connection.pool.end();
  }
};

void run();
