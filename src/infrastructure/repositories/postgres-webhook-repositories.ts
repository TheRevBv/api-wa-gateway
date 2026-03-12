import { and, eq } from "drizzle-orm";

import type {
  WebhookDispatchRepository,
  WebhookSubscriptionRepository
} from "../../application/ports/repositories";
import type { DatabaseClient } from "../database/client";
import { webhookDispatchesTable, webhookSubscriptionsTable } from "../database/schema";

export class PostgresWebhookSubscriptionRepository implements WebhookSubscriptionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findActiveByTenantId(tenantId: string) {
    const [subscription] = await this.db
      .select()
      .from(webhookSubscriptionsTable)
      .where(
        and(
          eq(webhookSubscriptionsTable.tenantId, tenantId),
          eq(webhookSubscriptionsTable.isActive, true)
        )
      )
      .limit(1);

    return subscription ?? null;
  }
}

export class PostgresWebhookDispatchRepository implements WebhookDispatchRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    messageId: string;
    subscriptionId: string;
    requestPayload: unknown;
  }) {
    const [dispatch] = await this.db
      .insert(webhookDispatchesTable)
      .values({
        ...input,
        responsePayload: null,
        status: "pending",
        responseCode: null,
        errorMessage: null,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return dispatch;
  }

  async markSucceeded(input: {
    id: string;
    attempts: number;
    responseCode: number;
    responsePayload: unknown;
  }) {
    await this.db
      .update(webhookDispatchesTable)
      .set({
        status: "succeeded",
        attempts: input.attempts,
        responseCode: input.responseCode,
        responsePayload: input.responsePayload,
        errorMessage: null,
        updatedAt: new Date()
      })
      .where(eq(webhookDispatchesTable.id, input.id));
  }

  async markFailed(input: {
    id: string;
    attempts: number;
    responseCode: number | null;
    responsePayload: unknown;
    errorMessage: string;
  }) {
    await this.db
      .update(webhookDispatchesTable)
      .set({
        status: "failed",
        attempts: input.attempts,
        responseCode: input.responseCode,
        responsePayload: input.responsePayload,
        errorMessage: input.errorMessage,
        updatedAt: new Date()
      })
      .where(eq(webhookDispatchesTable.id, input.id));
  }
}
