import type { Contact } from "../../domain/messaging/contact";
import type { Conversation } from "../../domain/messaging/conversation";
import type { Message } from "../../domain/messaging/message";
import { ApplicationError } from "../errors/application-error";
import type { RepositoryBundle, SendMessageInput } from "../ports/repositories";
import type { WhatsAppProviderRegistry } from "../ports/whatsapp-provider";
import { createId } from "../services/id";

export interface SendOutboundMessageResult {
  contact: Contact;
  conversation: Conversation;
  message: Message;
}

export class SendOutboundMessageUseCase {
  constructor(
    private readonly repositories: RepositoryBundle,
    private readonly providerRegistry: WhatsAppProviderRegistry
  ) {}

  async execute(input: SendMessageInput): Promise<SendOutboundMessageResult> {
    const tenant = await this.repositories.tenants.findById(input.tenantId);

    if (!tenant || tenant.status !== "active") {
      throw new ApplicationError("Tenant is not available", {
        code: "tenant_not_available",
        statusCode: 404
      });
    }

    const connection = await this.repositories.providerConnections.findActiveByTenantId(input.tenantId);

    if (!connection) {
      throw new ApplicationError("No active provider connection for tenant", {
        code: "provider_connection_not_found",
        statusCode: 409
      });
    }

    const contact = await this.findOrCreateContact(input.tenantId, input.to);
    const conversation = await this.findOrCreateConversation(input.tenantId, contact.id);
    const provider = this.providerRegistry.get(connection.provider);
    const attemptedAt = new Date();

    const providerResult = await provider.sendMessage({
      connection,
      to: input.to,
      content: input.content
    });

    if (providerResult.status === "failed") {
      await this.repositories.messages.create({
        id: createId(),
        tenantId: input.tenantId,
        conversationId: conversation.id,
        contactId: contact.id,
        provider: connection.provider,
        providerMessageId: providerResult.providerMessageId,
        direction: "outbound",
        type: input.content.type,
        body: input.content.type === "text" ? input.content.text : input.content.caption ?? null,
        media:
          input.content.type === "text"
            ? null
            : {
                url: input.content.mediaUrl,
                mimeType: input.content.mimeType,
                filename: input.content.fileName,
                caption: input.content.caption
              },
        payloadRaw: providerResult.payloadRaw,
        status: "failed",
        sentAt: null,
        receivedAt: null
      });

      await this.repositories.conversations.touchLastMessageAt(conversation.id, attemptedAt);

      throw new ApplicationError("Provider rejected the outbound message", {
        code: "provider_send_failed",
        statusCode: 502
      });
    }

    const message = await this.repositories.messages.create({
      id: createId(),
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      provider: connection.provider,
      providerMessageId: providerResult.providerMessageId,
      direction: "outbound",
      type: input.content.type,
      body: input.content.type === "text" ? input.content.text : input.content.caption ?? null,
      media:
        input.content.type === "text"
          ? null
          : {
              url: input.content.mediaUrl,
              mimeType: input.content.mimeType,
              filename: input.content.fileName,
              caption: input.content.caption
            },
      payloadRaw: providerResult.payloadRaw,
      status: "sent",
      sentAt: providerResult.sentAt ?? attemptedAt,
      receivedAt: null
    });

    const lastMessageAt = providerResult.sentAt ?? attemptedAt;

    await this.repositories.conversations.touchLastMessageAt(conversation.id, lastMessageAt);

    return {
      contact,
      conversation: {
        ...conversation,
        lastMessageAt
      },
      message
    };
  }

  private async findOrCreateContact(tenantId: string, phone: string): Promise<Contact> {
    const existingContact = await this.repositories.contacts.findByTenantAndPhone(tenantId, phone);

    if (existingContact) {
      return existingContact;
    }

    return this.repositories.contacts.create({
      id: createId(),
      tenantId,
      phone,
      displayName: null,
      providerContactId: null
    });
  }

  private async findOrCreateConversation(tenantId: string, contactId: string): Promise<Conversation> {
    const now = new Date();
    const existingConversation = await this.repositories.conversations.findByTenantAndContact(
      tenantId,
      contactId,
      "whatsapp"
    );

    if (existingConversation) {
      return existingConversation;
    }

    return this.repositories.conversations.create({
      id: createId(),
      tenantId,
      contactId,
      channel: "whatsapp",
      status: "active",
      startedAt: now,
      lastMessageAt: now
    });
  }
}
