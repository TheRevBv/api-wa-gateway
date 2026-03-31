import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";

import type { ConversationChannel, ConversationStatus } from "../../domain/messaging/conversation";
import type { MessageMedia, MessageDirection, MessageStatus, MessageType } from "../../domain/messaging/message";
import type { ProviderConnectionStatus, ProviderName } from "../../domain/providers/provider-connection";
import type { TenantStatus } from "../../domain/tenants/tenant";
import type { WebhookDispatchStatus } from "../../domain/webhooks/webhook-dispatch";

export const tenantsTable = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").$type<TenantStatus>().notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("tenants_name_idx").on(table.name)]
);

export const providerConnectionsTable = pgTable(
  "provider_connections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    provider: text("provider").$type<ProviderName>().notNull(),
    connectionKey: text("connection_key").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").$type<ProviderConnectionStatus>().notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("provider_connections_connection_key_idx").on(table.connectionKey),
    uniqueIndex("provider_connections_tenant_provider_idx").on(table.tenantId, table.provider),
    uniqueIndex("provider_connections_tenant_active_idx")
      .on(table.tenantId)
      .where(sql`${table.status} = 'active'`)
  ]
);

export const providerMessageTemplatesTable = pgTable(
  "provider_message_templates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    providerConnectionId: text("provider_connection_id")
      .notNull()
      .references(() => providerConnectionsTable.id),
    provider: text("provider").$type<ProviderName>().notNull(),
    externalTemplateId: text("external_template_id"),
    providerTemplateName: text("provider_template_name").notNull(),
    languageCode: text("language_code").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    lastError: text("last_error"),
    payloadRaw: jsonb("payload_raw").$type<unknown>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("provider_message_templates_connection_name_lang_idx").on(
      table.providerConnectionId,
      table.providerTemplateName,
      table.languageCode
    ),
    uniqueIndex("provider_message_templates_external_template_idx")
      .on(table.externalTemplateId)
      .where(sql`${table.externalTemplateId} is not null`),
    index("provider_message_templates_tenant_idx").on(table.tenantId),
    index("provider_message_templates_connection_idx").on(table.providerConnectionId)
  ]
);

export const contactsTable = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    phone: text("phone").notNull(),
    displayName: text("display_name"),
    providerContactId: text("provider_contact_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("contacts_tenant_phone_idx").on(table.tenantId, table.phone),
    index("contacts_tenant_id_idx").on(table.tenantId)
  ]
);

export const conversationsTable = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactsTable.id),
    channel: text("channel").$type<ConversationChannel>().notNull(),
    status: text("status").$type<ConversationStatus>().notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull(),
    lastMessageAt: timestamp("last_message_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("conversations_tenant_contact_channel_idx").on(
      table.tenantId,
      table.contactId,
      table.channel
    ),
    index("conversations_tenant_last_message_idx").on(table.tenantId, table.lastMessageAt)
  ]
);

export const messagesTable = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contactsTable.id),
    provider: text("provider").$type<ProviderName>().notNull(),
    providerMessageId: text("provider_message_id"),
    direction: text("direction").$type<MessageDirection>().notNull(),
    type: text("type").$type<MessageType>().notNull(),
    body: text("body"),
    media: jsonb("media").$type<MessageMedia | null>(),
    payloadRaw: jsonb("payload_raw").$type<unknown>().notNull(),
    status: text("status").$type<MessageStatus>().notNull(),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    receivedAt: timestamp("received_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("messages_tenant_provider_provider_message_idx").on(
      table.tenantId,
      table.provider,
      table.providerMessageId
    ),
    index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt)
  ]
);

export const webhookSubscriptionsTable = pgTable(
  "webhook_subscriptions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    callbackUrl: text("callback_url").notNull(),
    secret: text("secret"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("webhook_subscriptions_tenant_active_idx").on(table.tenantId, table.isActive)]
);

export const webhookDispatchesTable = pgTable(
  "webhook_dispatches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenantsTable.id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversationsTable.id),
    messageId: text("message_id")
      .notNull()
      .references(() => messagesTable.id),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => webhookSubscriptionsTable.id),
    requestPayload: jsonb("request_payload").$type<unknown>().notNull(),
    responsePayload: jsonb("response_payload").$type<unknown>(),
    status: text("status").$type<WebhookDispatchStatus>().notNull(),
    responseCode: integer("response_code"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("webhook_dispatches_tenant_created_at_idx").on(table.tenantId, table.createdAt)]
);

export const schema = {
  tenantsTable,
  providerConnectionsTable,
  providerMessageTemplatesTable,
  contactsTable,
  conversationsTable,
  messagesTable,
  webhookSubscriptionsTable,
  webhookDispatchesTable
};
