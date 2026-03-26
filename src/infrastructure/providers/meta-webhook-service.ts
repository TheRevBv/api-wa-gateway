import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { ApplicationError } from "../../application/errors/application-error";
import type { MetaWebhookEventInput, MetaWebhookEventResult, MetaWebhookService, MetaWebhookVerificationInput } from "../../application/ports/meta-webhook-service";
import type { MessageRepository, ProviderConnectionRepository } from "../../application/ports/repositories";
import type { WebhookDispatchService } from "../../application/ports/webhook-dispatcher";
import type { InboundMessageContent, InboundProviderMessage } from "../../application/ports/whatsapp-provider";
import type { ReceiveInboundMessageUseCase } from "../../application/use-cases/receive-inbound-message";
import { parseMetaProviderConfig } from "./meta-provider-config";

const metaWebhookEnvelopeSchema = z.object({
  object: z.string().optional(),
  entry: z
    .array(
      z.object({
        changes: z.array(
          z.object({
            field: z.string(),
            value: z
              .object({
                metadata: z
                  .object({
                    phone_number_id: z.string()
                  })
                  .optional(),
                contacts: z
                  .array(
                    z.object({
                      wa_id: z.string(),
                      profile: z
                        .object({
                          name: z.string().optional()
                        })
                        .optional()
                    })
                  )
                  .optional(),
                messages: z
                  .array(
                    z.object({
                      id: z.string(),
                      from: z.string(),
                      timestamp: z.string(),
                      type: z.string()
                    }).passthrough()
                  )
                  .optional(),
                statuses: z.array(z.unknown()).optional()
              })
              .passthrough()
          })
        )
      })
    )
    .default([])
});

const textMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.literal("text"),
  text: z.object({
    body: z.string()
  })
});

const imageMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.literal("image"),
  image: z.object({
    id: z.string(),
    mime_type: z.string().optional(),
    caption: z.string().optional()
  })
});

const documentMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.literal("document"),
  document: z.object({
    id: z.string(),
    mime_type: z.string().optional(),
    caption: z.string().optional(),
    filename: z.string().optional()
  })
});

const statusMessageSchema = z
  .object({
    id: z.string(),
    status: z.enum(["accepted", "sent", "delivered", "read", "failed"]),
    timestamp: z.string().optional(),
    recipient_id: z.string().optional(),
    errors: z
      .array(
        z
          .object({
            code: z.number().optional(),
            title: z.string().optional(),
            message: z.string().optional(),
            error_data: z
              .object({
                details: z.string().optional()
              })
              .optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

const unixTimestampToDate = (value: string): Date => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return new Date();
  }

  return new Date(parsed * 1000);
};

const safeCompareSignature = (expected: string, actual: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

const toInboundContent = (message: z.infer<typeof textMessageSchema> | z.infer<typeof imageMessageSchema> | z.infer<typeof documentMessageSchema>): InboundMessageContent => {
  switch (message.type) {
    case "text":
      return {
        type: "text",
        text: message.text.body
      };
    case "image":
      return {
        type: "image",
        providerMediaId: message.image.id,
        mimeType: message.image.mime_type,
        caption: message.image.caption
      };
    case "document":
      return {
        type: "document",
        providerMediaId: message.document.id,
        mimeType: message.document.mime_type,
        caption: message.document.caption,
        fileName: message.document.filename
      };
  }
};

export class DefaultMetaWebhookService implements MetaWebhookService {
  constructor(
    private readonly providerConnections: ProviderConnectionRepository,
    private readonly receiveInboundMessage: ReceiveInboundMessageUseCase,
    private readonly messages: MessageRepository,
    private readonly webhookDispatchService: WebhookDispatchService
  ) {}

  async verifyWebhook(input: MetaWebhookVerificationInput): Promise<string> {
    const connection = await this.providerConnections.findActiveByProviderAndConnectionKey(
      "meta",
      input.connectionKey
    );

    if (!connection) {
      throw new ApplicationError("Meta provider connection was not found", {
        code: "provider_connection_not_found",
        statusCode: 404
      });
    }

    const config = parseMetaProviderConfig(connection.config);

    if (input.mode !== "subscribe" || !input.challenge || input.verifyToken !== config.verifyToken) {
      throw new ApplicationError("Meta webhook verification failed", {
        code: "meta_webhook_verification_failed",
        statusCode: 403
      });
    }

    return input.challenge;
  }

  async handleWebhookEvent(input: MetaWebhookEventInput): Promise<MetaWebhookEventResult> {
    const connection = await this.providerConnections.findActiveByProviderAndConnectionKey(
      "meta",
      input.connectionKey
    );

    if (!connection) {
      throw new ApplicationError("Meta provider connection was not found", {
        code: "provider_connection_not_found",
        statusCode: 404
      });
    }

    const config = parseMetaProviderConfig(connection.config);
    this.assertValidSignature(input.rawBody, input.signatureHeader, config.appSecret);

    const parsed = metaWebhookEnvelopeSchema.safeParse(input.payload);

    if (!parsed.success) {
      throw new ApplicationError("Meta webhook payload is invalid", {
        code: "meta_webhook_payload_invalid",
        statusCode: 400
      });
    }

    let processedMessages = 0;
    let processedStatuses = 0;
    let ignoredEvents = 0;

    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") {
          ignoredEvents += 1;
          continue;
        }

        const phoneNumberId = change.value.metadata?.phone_number_id;

        if (!phoneNumberId) {
          ignoredEvents += 1;
          continue;
        }

        if (phoneNumberId !== input.connectionKey) {
          throw new ApplicationError("Meta webhook phone number does not match the route connection key", {
            code: "meta_webhook_connection_mismatch",
            statusCode: 400
          });
        }

        if (change.value.statuses && change.value.statuses.length > 0) {
          for (const rawStatus of change.value.statuses) {
            const processedStatus = await this.applyStatusUpdate(connection.tenantId, rawStatus);

            if (processedStatus) {
              processedStatuses += 1;
              continue;
            }

            ignoredEvents += 1;
          }
        }

        if (!change.value.messages || change.value.messages.length === 0) {
          if (!change.value.statuses || change.value.statuses.length === 0) {
            ignoredEvents += 1;
          }

          continue;
        }

        for (const rawMessage of change.value.messages) {
          const message = this.toInboundMessage(connection.tenantId, change.value.contacts ?? [], rawMessage, input.payload);

          if (!message) {
            ignoredEvents += 1;
            continue;
          }

          await this.receiveInboundMessage.execute(message);
          processedMessages += 1;
        }
      }
    }

    return {
      processedMessages,
      processedStatuses,
      ignoredEvents
    };
  }

  private assertValidSignature(rawBody: string, signatureHeader: string | undefined, appSecret: string): void {
    if (!signatureHeader) {
      throw new ApplicationError("Meta webhook signature is missing", {
        code: "meta_webhook_signature_invalid",
        statusCode: 401
      });
    }

    const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

    if (!safeCompareSignature(expectedSignature, signatureHeader.trim())) {
      throw new ApplicationError("Meta webhook signature is invalid", {
        code: "meta_webhook_signature_invalid",
        statusCode: 401
      });
    }
  }

  private toInboundMessage(
    tenantId: string,
    contacts: Array<{ wa_id: string; profile?: { name?: string } }>,
    rawMessage: Record<string, unknown>,
    payloadRaw: unknown
  ): InboundProviderMessage | null {
    const matchingContact = contacts.find((contact) => contact.wa_id === rawMessage.from) ?? contacts[0];
    const displayName = matchingContact?.profile?.name ?? null;
    const providerContactId = matchingContact?.wa_id ?? rawMessage.from;

    if (rawMessage.type === "text") {
      const parsed = textMessageSchema.safeParse(rawMessage);

      if (!parsed.success) {
        throw new ApplicationError("Meta text message payload is invalid", {
          code: "meta_webhook_payload_invalid",
          statusCode: 400
        });
      }

      return {
        tenantId,
        provider: "meta",
        providerMessageId: parsed.data.id,
        providerContactId,
        from: parsed.data.from,
        displayName,
        content: toInboundContent(parsed.data),
        payloadRaw,
        receivedAt: unixTimestampToDate(parsed.data.timestamp)
      };
    }

    if (rawMessage.type === "image") {
      const parsed = imageMessageSchema.safeParse(rawMessage);

      if (!parsed.success) {
        throw new ApplicationError("Meta image message payload is invalid", {
          code: "meta_webhook_payload_invalid",
          statusCode: 400
        });
      }

      return {
        tenantId,
        provider: "meta",
        providerMessageId: parsed.data.id,
        providerContactId,
        from: parsed.data.from,
        displayName,
        content: toInboundContent(parsed.data),
        payloadRaw,
        receivedAt: unixTimestampToDate(parsed.data.timestamp)
      };
    }

    if (rawMessage.type === "document") {
      const parsed = documentMessageSchema.safeParse(rawMessage);

      if (!parsed.success) {
        throw new ApplicationError("Meta document message payload is invalid", {
          code: "meta_webhook_payload_invalid",
          statusCode: 400
        });
      }

      return {
        tenantId,
        provider: "meta",
        providerMessageId: parsed.data.id,
        providerContactId,
        from: parsed.data.from,
        displayName,
        content: toInboundContent(parsed.data),
        payloadRaw,
        receivedAt: unixTimestampToDate(parsed.data.timestamp)
      };
    }

    return null;
  }

  private async applyStatusUpdate(tenantId: string, rawStatus: unknown): Promise<boolean> {
    const parsed = statusMessageSchema.safeParse(rawStatus);

    if (!parsed.success) {
      throw new ApplicationError("Meta status payload is invalid", {
        code: "meta_webhook_payload_invalid",
        statusCode: 400
      });
    }

    const updated = await this.messages.updateStatusByProviderMessageId({
      tenantId,
      provider: "meta",
      providerMessageId: parsed.data.id,
      status: parsed.data.status,
      sentAt: parsed.data.timestamp ? unixTimestampToDate(parsed.data.timestamp) : undefined,
      payloadRaw: parsed.data
    });

    if (!updated) {
      return false;
    }

    const context = await this.messages.findContextByMessageId(updated.message.id);

    if (context) {
      await this.webhookDispatchService.dispatchMessageStatusUpdated({
        context,
        previousStatus: updated.previousStatus,
      });
    }

    return true;
  }
}
