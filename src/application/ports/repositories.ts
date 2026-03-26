import type { Contact } from "../../domain/messaging/contact";
import type { Conversation } from "../../domain/messaging/conversation";
import type { Message, MessageContent, MessageStatus } from "../../domain/messaging/message";
import type { ProviderConnection, ProviderName } from "../../domain/providers/provider-connection";
import type { Tenant } from "../../domain/tenants/tenant";
import type { WebhookDispatch } from "../../domain/webhooks/webhook-dispatch";
import type { WebhookSubscription } from "../../domain/webhooks/webhook-subscription";

export interface PaginationQuery {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConversationListItem {
  conversation: Conversation;
  contact: Contact;
}

export interface MessageWithConversationContext {
  tenant: Tenant;
  contact: Contact;
  conversation: Conversation;
  message: Message;
}

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
}

export interface ContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByTenantAndPhone(tenantId: string, phone: string): Promise<Contact | null>;
  create(input: {
    id: string;
    tenantId: string;
    phone: string;
    displayName: string | null;
    providerContactId: string | null;
  }): Promise<Contact>;
  updateDetails(input: {
    id: string;
    displayName: string | null;
    providerContactId: string | null;
  }): Promise<Contact>;
}

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByTenantAndContact(
    tenantId: string,
    contactId: string,
    channel: Conversation["channel"]
  ): Promise<Conversation | null>;
  create(input: {
    id: string;
    tenantId: string;
    contactId: string;
    channel: Conversation["channel"];
    status: Conversation["status"];
    startedAt: Date;
    lastMessageAt: Date;
  }): Promise<Conversation>;
  touchLastMessageAt(id: string, lastMessageAt: Date): Promise<void>;
  listByTenant(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<ConversationListItem>>;
}

export interface MessageRepository {
  findById(id: string): Promise<Message | null>;
  findContextByMessageId(id: string): Promise<MessageWithConversationContext | null>;
  findByProviderMessageId(
    tenantId: string,
    provider: ProviderName,
    providerMessageId: string
  ): Promise<Message | null>;
  create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;
    provider: ProviderName;
    providerMessageId: string | null;
    direction: Message["direction"];
    type: Message["type"];
    body: string | null;
    media: Message["media"];
    payloadRaw: unknown;
    status: MessageStatus;
    sentAt: Date | null;
    receivedAt: Date | null;
  }): Promise<Message>;
  updateStatusByProviderMessageId(input: {
    tenantId: string;
    provider: ProviderName;
    providerMessageId: string;
    status: MessageStatus;
    sentAt?: Date | null;
    payloadRaw?: unknown;
  }): Promise<{ message: Message; previousStatus: MessageStatus } | null>;
  listByConversation(
    tenantId: string,
    conversationId: string,
    query: PaginationQuery
  ): Promise<PaginatedResult<Message>>;
}

export interface ProviderConnectionRepository {
  findActiveByTenantId(tenantId: string): Promise<ProviderConnection | null>;
  findActiveByTenantIdAndProvider(
    tenantId: string,
    provider: ProviderName
  ): Promise<ProviderConnection | null>;
  findActiveByProviderAndConnectionKey(
    provider: ProviderName,
    connectionKey: string
  ): Promise<ProviderConnection | null>;
  listActiveByProvider(provider: ProviderName): Promise<ProviderConnection[]>;
}

export interface WebhookSubscriptionRepository {
  findActiveByTenantId(tenantId: string): Promise<WebhookSubscription | null>;
}

export interface WebhookDispatchRepository {
  create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    messageId: string;
    subscriptionId: string;
    requestPayload: unknown;
  }): Promise<WebhookDispatch>;
  markSucceeded(input: {
    id: string;
    attempts: number;
    responseCode: number;
    responsePayload: unknown;
  }): Promise<void>;
  markFailed(input: {
    id: string;
    attempts: number;
    responseCode: number | null;
    responsePayload: unknown;
    errorMessage: string;
  }): Promise<void>;
}

export interface RepositoryBundle {
  tenants: TenantRepository;
  contacts: ContactRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  providerConnections: ProviderConnectionRepository;
  webhookSubscriptions: WebhookSubscriptionRepository;
  webhookDispatches: WebhookDispatchRepository;
}

export interface SendMessageInput {
  tenantId: string;
  to: string;
  content: MessageContent;
}
