import { and, asc, count, desc, eq } from "drizzle-orm";

import type {
  ContactRepository,
  ConversationRepository,
  MessageRepository
} from "../../application/ports/repositories";
import type { DatabaseClient } from "../database/client";
import { contactsTable, conversationsTable, messagesTable } from "../database/schema";

const appendProviderStatusEvent = (current: unknown, event: unknown): unknown => {
  if (event === undefined) {
    return current;
  }

  if (typeof current === "object" && current !== null && !Array.isArray(current)) {
    const record = current as Record<string, unknown>;
    const existingEvents = Array.isArray(record.providerStatusEvents) ? record.providerStatusEvents : [];

    return {
      ...record,
      providerStatusEvents: [...existingEvents, event]
    };
  }

  return {
    initialPayloadRaw: current,
    providerStatusEvents: [event]
  };
};

export class PostgresContactRepository implements ContactRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [contact] = await this.db.select().from(contactsTable).where(eq(contactsTable.id, id)).limit(1);
    return contact ?? null;
  }

  async findByTenantAndPhone(tenantId: string, phone: string) {
    const [contact] = await this.db
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.tenantId, tenantId), eq(contactsTable.phone, phone)))
      .limit(1);

    return contact ?? null;
  }

  async create(input: {
    id: string;
    tenantId: string;
    phone: string;
    displayName: string | null;
    providerContactId: string | null;
  }) {
    const [contact] = await this.db
      .insert(contactsTable)
      .values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return contact;
  }

  async updateDetails(input: { id: string; displayName: string | null; providerContactId: string | null }) {
    const [contact] = await this.db
      .update(contactsTable)
      .set({
        displayName: input.displayName,
        providerContactId: input.providerContactId,
        updatedAt: new Date()
      })
      .where(eq(contactsTable.id, input.id))
      .returning();

    return contact;
  }
}

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [conversation] = await this.db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .limit(1);

    return conversation ?? null;
  }

  async findByTenantAndContact(tenantId: string, contactId: string, channel: "whatsapp") {
    const [conversation] = await this.db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.tenantId, tenantId),
          eq(conversationsTable.contactId, contactId),
          eq(conversationsTable.channel, channel)
        )
      )
      .limit(1);

    return conversation ?? null;
  }

  async create(input: {
    id: string;
    tenantId: string;
    contactId: string;
    channel: "whatsapp";
    status: "active" | "archived";
    startedAt: Date;
    lastMessageAt: Date;
  }) {
    const [conversation] = await this.db
      .insert(conversationsTable)
      .values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return conversation;
  }

  async touchLastMessageAt(id: string, lastMessageAt: Date) {
    await this.db
      .update(conversationsTable)
      .set({
        lastMessageAt,
        updatedAt: new Date()
      })
      .where(eq(conversationsTable.id, id));
  }

  async listByTenant(tenantId: string, query: { limit: number; offset: number }) {
    const items = await this.db
      .select({
        conversation: conversationsTable,
        contact: contactsTable
      })
      .from(conversationsTable)
      .innerJoin(contactsTable, eq(conversationsTable.contactId, contactsTable.id))
      .where(eq(conversationsTable.tenantId, tenantId))
      .orderBy(desc(conversationsTable.lastMessageAt), desc(conversationsTable.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    const [totals] = await this.db
      .select({
        value: count()
      })
      .from(conversationsTable)
      .where(eq(conversationsTable.tenantId, tenantId));

    return {
      items,
      total: totals?.value ?? 0,
      limit: query.limit,
      offset: query.offset
    };
  }
}

export class PostgresMessageRepository implements MessageRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string) {
    const [message] = await this.db.select().from(messagesTable).where(eq(messagesTable.id, id)).limit(1);
    return message ?? null;
  }

  async findByProviderMessageId(tenantId: string, provider: "baileys" | "meta", providerMessageId: string) {
    const [message] = await this.db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.tenantId, tenantId),
          eq(messagesTable.provider, provider),
          eq(messagesTable.providerMessageId, providerMessageId)
        )
      )
      .limit(1);

    return message ?? null;
  }

  async create(input: {
    id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;
    provider: "baileys" | "meta";
    providerMessageId: string | null;
    direction: "inbound" | "outbound";
    type: "text" | "image" | "document" | "template";
    body: string | null;
    media: {
      url: string;
      mimeType?: string;
      filename?: string;
      caption?: string;
    } | null;
    payloadRaw: unknown;
    status: "received" | "accepted" | "sent" | "delivered" | "read" | "failed";
    sentAt: Date | null;
    receivedAt: Date | null;
  }) {
    const [message] = await this.db
      .insert(messagesTable)
      .values({
        ...input,
        createdAt: new Date()
      })
      .returning();

    return message;
  }

  async updateStatusByProviderMessageId(input: {
    tenantId: string;
    provider: "baileys" | "meta";
    providerMessageId: string;
    status: "received" | "accepted" | "sent" | "delivered" | "read" | "failed";
    sentAt?: Date | null;
    payloadRaw?: unknown;
  }) {
    const existing = await this.findByProviderMessageId(
      input.tenantId,
      input.provider,
      input.providerMessageId
    );

    if (!existing) {
      return null;
    }

    const [message] = await this.db
      .update(messagesTable)
      .set({
        status: input.status,
        sentAt: input.sentAt ?? existing.sentAt,
        payloadRaw: appendProviderStatusEvent(existing.payloadRaw, input.payloadRaw)
      })
      .where(eq(messagesTable.id, existing.id))
      .returning();

    return message ?? null;
  }

  async listByConversation(tenantId: string, conversationId: string, query: { limit: number; offset: number }) {
    const items = await this.db
      .select()
      .from(messagesTable)
      .where(
        and(eq(messagesTable.tenantId, tenantId), eq(messagesTable.conversationId, conversationId))
      )
      .orderBy(asc(messagesTable.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    const [totals] = await this.db
      .select({
        value: count()
      })
      .from(messagesTable)
      .where(
        and(eq(messagesTable.tenantId, tenantId), eq(messagesTable.conversationId, conversationId))
      );

    return {
      items,
      total: totals?.value ?? 0,
      limit: query.limit,
      offset: query.offset
    };
  }
}
