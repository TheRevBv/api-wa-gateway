import type { MessageWithConversationContext } from "../ports/repositories";

export interface InboundMessageWebhookPayload {
  event: "message.received";
  occurredAt: string;
  tenant: {
    id: string;
    name: string;
  };
  conversation: {
    id: string;
    channel: string;
    status: string;
    startedAt: string;
    lastMessageAt: string;
  };
  contact: {
    id: string;
    phone: string;
    displayName: string | null;
    providerContactId: string | null;
  };
  message: {
    id: string;
    provider: string;
    providerMessageId: string | null;
    direction: string;
    type: string;
    body: string | null;
    media: MessageWithConversationContext["message"]["media"];
    status: string;
    sentAt: string | null;
    receivedAt: string | null;
    createdAt: string;
  };
}

export const buildInboundMessageWebhookPayload = (
  context: MessageWithConversationContext
): InboundMessageWebhookPayload => ({
  event: "message.received",
  occurredAt: context.message.receivedAt?.toISOString() ?? context.message.createdAt.toISOString(),
  tenant: {
    id: context.tenant.id,
    name: context.tenant.name
  },
  conversation: {
    id: context.conversation.id,
    channel: context.conversation.channel,
    status: context.conversation.status,
    startedAt: context.conversation.startedAt.toISOString(),
    lastMessageAt: context.conversation.lastMessageAt.toISOString()
  },
  contact: {
    id: context.contact.id,
    phone: context.contact.phone,
    displayName: context.contact.displayName,
    providerContactId: context.contact.providerContactId
  },
  message: {
    id: context.message.id,
    provider: context.message.provider,
    providerMessageId: context.message.providerMessageId,
    direction: context.message.direction,
    type: context.message.type,
    body: context.message.body,
    media: context.message.media,
    status: context.message.status,
    sentAt: context.message.sentAt?.toISOString() ?? null,
    receivedAt: context.message.receivedAt?.toISOString() ?? null,
    createdAt: context.message.createdAt.toISOString()
  }
});
