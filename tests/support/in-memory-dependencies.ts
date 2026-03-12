import type {
  BaileysSessionSnapshot,
  BaileysSessionViewService
} from "../../src/application/ports/baileys-session-view";
import type {
  ContactRepository,
  ConversationRepository,
  MessageRepository,
  PaginatedResult,
  ProviderConnectionRepository,
  RepositoryBundle,
  TenantRepository,
  WebhookDispatchRepository,
  WebhookSubscriptionRepository
} from "../../src/application/ports/repositories";
import type { WebhookDispatchService } from "../../src/application/ports/webhook-dispatcher";
import type {
  ProviderSendMessageCommand,
  ProviderSendMessageResult,
  WhatsAppProvider,
  WhatsAppProviderRegistry
} from "../../src/application/ports/whatsapp-provider";
import type { Contact } from "../../src/domain/messaging/contact";
import type { Conversation } from "../../src/domain/messaging/conversation";
import type { Message } from "../../src/domain/messaging/message";
import type { ProviderConnection } from "../../src/domain/providers/provider-connection";
import type { Tenant } from "../../src/domain/tenants/tenant";
import type { WebhookDispatch } from "../../src/domain/webhooks/webhook-dispatch";
import type { WebhookSubscription } from "../../src/domain/webhooks/webhook-subscription";

const now = () => new Date();

export class InMemoryTenantRepository implements TenantRepository {
  constructor(private readonly items = new Map<string, Tenant>()) {}

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  set(tenant: Tenant): void {
    this.items.set(tenant.id, tenant);
  }
}

export class InMemoryContactRepository implements ContactRepository {
  constructor(private readonly items = new Map<string, Contact>()) {}

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByTenantAndPhone(tenantId: string, phone: string) {
    return (
      [...this.items.values()].find((contact) => contact.tenantId === tenantId && contact.phone === phone) ??
      null
    );
  }

  async create(input: {
    id: string;
    tenantId: string;
    phone: string;
    displayName: string | null;
    providerContactId: string | null;
  }) {
    const created: Contact = {
      ...input,
      createdAt: now(),
      updatedAt: now()
    };
    this.items.set(created.id, created);
    return created;
  }

  async updateDetails(input: { id: string; displayName: string | null; providerContactId: string | null }) {
    const existing = this.items.get(input.id);

    if (!existing) {
      throw new Error("Contact not found");
    }

    const updated: Contact = {
      ...existing,
      displayName: input.displayName,
      providerContactId: input.providerContactId,
      updatedAt: now()
    };
    this.items.set(updated.id, updated);
    return updated;
  }

  all(): Contact[] {
    return [...this.items.values()];
  }
}

export class InMemoryConversationRepository implements ConversationRepository {
  constructor(private readonly items = new Map<string, Conversation>()) {}

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByTenantAndContact(tenantId: string, contactId: string, channel: Conversation["channel"]) {
    return (
      [...this.items.values()].find(
        (conversation) =>
          conversation.tenantId === tenantId &&
          conversation.contactId === contactId &&
          conversation.channel === channel
      ) ?? null
    );
  }

  async create(input: {
    id: string;
    tenantId: string;
    contactId: string;
    channel: Conversation["channel"];
    status: Conversation["status"];
    startedAt: Date;
    lastMessageAt: Date;
  }) {
    const created: Conversation = {
      ...input,
      createdAt: now(),
      updatedAt: now()
    };
    this.items.set(created.id, created);
    return created;
  }

  async touchLastMessageAt(id: string, lastMessageAt: Date) {
    const existing = this.items.get(id);

    if (!existing) {
      return;
    }

    this.items.set(id, {
      ...existing,
      lastMessageAt,
      updatedAt: now()
    });
  }

  async listByTenant(tenantId: string, query: { limit: number; offset: number }): Promise<PaginatedResult<{ conversation: Conversation; contact: Contact }>> {
    throw new Error("Conversation listing requires repository bundle helper");
  }

  all(): Conversation[] {
    return [...this.items.values()];
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  constructor(private readonly items = new Map<string, Message>()) {}

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByProviderMessageId(
    tenantId: string,
    provider: ProviderConnection["provider"],
    providerMessageId: string
  ) {
    return (
      [...this.items.values()].find(
        (message) =>
          message.tenantId === tenantId &&
          message.provider === provider &&
          message.providerMessageId === providerMessageId
      ) ?? null
    );
  }

  async create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;
    provider: ProviderConnection["provider"];
    providerMessageId: string | null;
    direction: Message["direction"];
    type: Message["type"];
    body: string | null;
    media: Message["media"];
    payloadRaw: unknown;
    status: Message["status"];
    sentAt: Date | null;
    receivedAt: Date | null;
  }) {
    const created: Message = {
      ...input,
      createdAt: now()
    };
    this.items.set(created.id, created);
    return created;
  }

  async listByConversation(tenantId: string, conversationId: string, query: { limit: number; offset: number }) {
    const filtered = [...this.items.values()]
      .filter((message) => message.tenantId === tenantId && message.conversationId === conversationId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset
    };
  }

  all(): Message[] {
    return [...this.items.values()];
  }
}

export class InMemoryProviderConnectionRepository implements ProviderConnectionRepository {
  constructor(private readonly items = new Map<string, ProviderConnection>()) {}

  async findActiveByTenantId(tenantId: string) {
    return (
      [...this.items.values()].find(
        (connection) => connection.tenantId === tenantId && connection.status === "active"
      ) ?? null
    );
  }

  async listActiveByProvider(provider: ProviderConnection["provider"]) {
    return [...this.items.values()].filter(
      (connection) => connection.provider === provider && connection.status === "active"
    );
  }

  set(connection: ProviderConnection): void {
    this.items.set(connection.id, connection);
  }

  delete(id: string): void {
    this.items.delete(id);
  }
}

export class InMemoryWebhookSubscriptionRepository implements WebhookSubscriptionRepository {
  constructor(private readonly items = new Map<string, WebhookSubscription>()) {}

  async findActiveByTenantId(tenantId: string) {
    return (
      [...this.items.values()].find(
        (subscription) => subscription.tenantId === tenantId && subscription.isActive
      ) ?? null
    );
  }

  set(subscription: WebhookSubscription): void {
    this.items.set(subscription.id, subscription);
  }
}

export class InMemoryWebhookDispatchRepository implements WebhookDispatchRepository {
  constructor(private readonly items = new Map<string, WebhookDispatch>()) {}

  async create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    messageId: string;
    subscriptionId: string;
    requestPayload: unknown;
  }) {
    const created: WebhookDispatch = {
      ...input,
      responsePayload: null,
      status: "pending",
      responseCode: null,
      errorMessage: null,
      attempts: 0,
      createdAt: now(),
      updatedAt: now()
    };
    this.items.set(created.id, created);
    return created;
  }

  async markSucceeded(input: {
    id: string;
    attempts: number;
    responseCode: number;
    responsePayload: unknown;
  }) {
    const existing = this.items.get(input.id);

    if (!existing) {
      throw new Error("Dispatch not found");
    }

    this.items.set(input.id, {
      ...existing,
      attempts: input.attempts,
      responseCode: input.responseCode,
      responsePayload: input.responsePayload,
      status: "succeeded",
      errorMessage: null,
      updatedAt: now()
    });
  }

  async markFailed(input: {
    id: string;
    attempts: number;
    responseCode: number | null;
    responsePayload: unknown;
    errorMessage: string;
  }) {
    const existing = this.items.get(input.id);

    if (!existing) {
      throw new Error("Dispatch not found");
    }

    this.items.set(input.id, {
      ...existing,
      attempts: input.attempts,
      responseCode: input.responseCode,
      responsePayload: input.responsePayload,
      status: "failed",
      errorMessage: input.errorMessage,
      updatedAt: now()
    });
  }

  all(): WebhookDispatch[] {
    return [...this.items.values()];
  }
}

export class RecordingWebhookDispatchService implements WebhookDispatchService {
  readonly dispatchedContexts = new Array<unknown>();

  async dispatchInboundMessage(context: unknown) {
    this.dispatchedContexts.push(context);
  }
}

export class FakeWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = "baileys" as const;
  readonly sentCommands: ProviderSendMessageCommand[] = [];
  nextError: Error | null = null;
  nextResult: ProviderSendMessageResult = {
    providerMessageId: "provider-message-1",
    payloadRaw: { ok: true },
    status: "sent",
    sentAt: new Date("2026-01-01T00:00:00.000Z")
  };

  async sendMessage(command: ProviderSendMessageCommand) {
    this.sentCommands.push(command);

    if (this.nextError) {
      const error = this.nextError;
      this.nextError = null;
      throw error;
    }

    return this.nextResult;
  }
}

export class FakeWhatsAppProviderRegistry implements WhatsAppProviderRegistry {
  constructor(private readonly provider: WhatsAppProvider) {}

  get() {
    return this.provider;
  }
}

export class FakeBaileysSessionViewService implements BaileysSessionViewService {
  enabled = true;
  sessions: BaileysSessionSnapshot[] = [];

  isEnabled(): boolean {
    return this.enabled;
  }

  async listSessions(filters?: { tenantId?: string; connectionKey?: string }): Promise<BaileysSessionSnapshot[]> {
    return this.sessions.filter((session) => {
      if (filters?.tenantId && session.tenantId !== filters.tenantId) {
        return false;
      }

      if (filters?.connectionKey && session.connectionKey !== filters.connectionKey) {
        return false;
      }

      return true;
    });
  }
}

export class InMemoryRepositoryBundle implements RepositoryBundle {
  readonly tenants = new InMemoryTenantRepository();
  readonly contacts = new InMemoryContactRepository();
  readonly conversations = new InMemoryConversationRepository();
  readonly messages = new InMemoryMessageRepository();
  readonly providerConnections = new InMemoryProviderConnectionRepository();
  readonly webhookSubscriptions = new InMemoryWebhookSubscriptionRepository();
  readonly webhookDispatches = new InMemoryWebhookDispatchRepository();

  async listConversations(tenantId: string, query: { limit: number; offset: number }) {
    const contacts = this.contacts.all();
    const filtered = this.conversations
      .all()
      .filter((conversation) => conversation.tenantId === tenantId)
      .sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime());

    return {
      items: filtered.slice(query.offset, query.offset + query.limit).map((conversation) => {
        const contact = contacts.find((item) => item.id === conversation.contactId);

        if (!contact) {
          throw new Error("Contact not found for conversation");
        }

        return {
          conversation,
          contact
        };
      }),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset
    };
  }
}

export const createTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: overrides.id ?? "tenant-1",
  name: overrides.name ?? "Tenant 1",
  status: overrides.status ?? "active",
  createdAt: overrides.createdAt ?? now(),
  updatedAt: overrides.updatedAt ?? now()
});

export const createProviderConnection = (
  overrides: Partial<ProviderConnection> = {}
): ProviderConnection => ({
  id: overrides.id ?? "connection-1",
  tenantId: overrides.tenantId ?? "tenant-1",
  provider: overrides.provider ?? "baileys",
  connectionKey: overrides.connectionKey ?? "tenant-1-session",
  displayName: overrides.displayName ?? "Tenant 1 Session",
  status: overrides.status ?? "active",
  config: overrides.config ?? {},
  createdAt: overrides.createdAt ?? now(),
  updatedAt: overrides.updatedAt ?? now()
});

export const createWebhookSubscription = (
  overrides: Partial<WebhookSubscription> = {}
): WebhookSubscription => ({
  id: overrides.id ?? "subscription-1",
  tenantId: overrides.tenantId ?? "tenant-1",
  callbackUrl: overrides.callbackUrl ?? "http://localhost/webhook",
  secret: overrides.secret ?? "secret",
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? now(),
  updatedAt: overrides.updatedAt ?? now()
});
