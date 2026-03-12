import type { Contact } from "../../domain/messaging/contact";
import type { Conversation } from "../../domain/messaging/conversation";
import type { Message } from "../../domain/messaging/message";

export const toContactResponse = (contact: Contact) => ({
  id: contact.id,
  tenantId: contact.tenantId,
  phone: contact.phone,
  displayName: contact.displayName,
  providerContactId: contact.providerContactId,
  createdAt: contact.createdAt.toISOString(),
  updatedAt: contact.updatedAt.toISOString()
});

export const toConversationResponse = (conversation: Conversation) => ({
  id: conversation.id,
  tenantId: conversation.tenantId,
  contactId: conversation.contactId,
  channel: conversation.channel,
  status: conversation.status,
  startedAt: conversation.startedAt.toISOString(),
  lastMessageAt: conversation.lastMessageAt.toISOString(),
  createdAt: conversation.createdAt.toISOString(),
  updatedAt: conversation.updatedAt.toISOString()
});

export const toMessageResponse = (message: Message) => ({
  id: message.id,
  tenantId: message.tenantId,
  conversationId: message.conversationId,
  contactId: message.contactId,
  provider: message.provider,
  providerMessageId: message.providerMessageId,
  direction: message.direction,
  type: message.type,
  body: message.body,
  media: message.media,
  status: message.status,
  sentAt: message.sentAt?.toISOString() ?? null,
  receivedAt: message.receivedAt?.toISOString() ?? null,
  createdAt: message.createdAt.toISOString()
});
