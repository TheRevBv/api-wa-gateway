import { createHmac } from "node:crypto";

import type { MessageStatus } from "../../domain/messaging/message";
import type { WebhookHttpClient, WebhookDispatchService } from "../ports/webhook-dispatcher";
import type {
  MessageWithConversationContext,
  WebhookDispatchRepository,
  WebhookSubscriptionRepository
} from "../ports/repositories";
import { createId } from "./id";
import {
  buildInboundMessageWebhookPayload,
  buildMessageStatusUpdatedWebhookPayload,
  type InboundMessageWebhookPayload,
  type MessageStatusUpdatedWebhookPayload
} from "./build-webhook-payload";

export interface DefaultWebhookDispatchServiceOptions {
  timeoutMs: number;
  retryAttempts: number;
}

export class DefaultWebhookDispatchService implements WebhookDispatchService {
  constructor(
    private readonly subscriptionRepository: WebhookSubscriptionRepository,
    private readonly dispatchRepository: WebhookDispatchRepository,
    private readonly webhookHttpClient: WebhookHttpClient,
    private readonly options: DefaultWebhookDispatchServiceOptions
  ) {}

  async dispatchInboundMessage(context: MessageWithConversationContext): Promise<void> {
    await this.dispatchMessageWebhook(
      context,
      buildInboundMessageWebhookPayload(context)
    );
  }

  async dispatchMessageStatusUpdated(input: {
    context: MessageWithConversationContext;
    previousStatus: MessageStatus;
  }): Promise<void> {
    await this.dispatchMessageWebhook(
      input.context,
      buildMessageStatusUpdatedWebhookPayload(
        input.context,
        input.previousStatus
      )
    );
  }

  private async dispatchMessageWebhook(
    context: MessageWithConversationContext,
    payload: InboundMessageWebhookPayload | MessageStatusUpdatedWebhookPayload
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findActiveByTenantId(context.tenant.id);

    if (!subscription) {
      return;
    }

    const dispatch = await this.dispatchRepository.create({
      id: createId(),
      tenantId: context.tenant.id,
      conversationId: context.conversation.id,
      messageId: context.message.id,
      subscriptionId: subscription.id,
      requestPayload: payload
    });

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-wa-gateway-event": payload.event
    };

    const serializedPayload = JSON.stringify(payload);

    if (subscription.secret) {
      headers["x-api-wa-gateway-signature"] = createHmac("sha256", subscription.secret)
        .update(serializedPayload)
        .digest("hex");
    }

    let attempts = 0;
    let lastStatusCode: number | null = null;
    let lastResponseBody: unknown = null;
    let lastError = "Webhook dispatch failed";

    while (attempts <= this.options.retryAttempts) {
      attempts += 1;

      try {
        const response = await this.webhookHttpClient.postJson({
          url: subscription.callbackUrl,
          timeoutMs: this.options.timeoutMs,
          headers,
          body: payload
        });

        lastStatusCode = response.statusCode;
        lastResponseBody = response.body;

        if (response.statusCode >= 200 && response.statusCode < 300) {
          await this.dispatchRepository.markSucceeded({
            id: dispatch.id,
            attempts,
            responseCode: response.statusCode,
            responsePayload: response.body
          });
          return;
        }

        lastError = `Webhook returned status ${response.statusCode}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown webhook dispatch error";
      }
    }

    await this.dispatchRepository.markFailed({
      id: dispatch.id,
      attempts,
      responseCode: lastStatusCode,
      responsePayload: lastResponseBody,
      errorMessage: lastError
    });
  }
}
