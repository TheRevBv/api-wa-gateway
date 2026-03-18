import type { Contact } from "../../domain/messaging/contact";
import type { Conversation } from "../../domain/messaging/conversation";
import type { Message } from "../../domain/messaging/message";
import { ApplicationError } from "../errors/application-error";
import type { RepositoryBundle } from "../ports/repositories";
import type { InboundProviderMessage } from "../ports/whatsapp-provider";
import type { WebhookDispatchService } from "../ports/webhook-dispatcher";
import { createId } from "../services/id";
import { getWhatsAppPhoneLookupCandidates, normalizeWhatsAppPhone } from "../services/normalize-whatsapp-phone";

export interface ReceiveInboundMessageResult {
  contact: Contact;
  conversation: Conversation;
  message: Message;
  duplicate: boolean;
}

export class ReceiveInboundMessageUseCase {
  constructor(
    private readonly repositories: RepositoryBundle,
    private readonly webhookDispatchService: WebhookDispatchService
  ) {}

  async execute(input: InboundProviderMessage): Promise<ReceiveInboundMessageResult> {
    const tenant = await this.repositories.tenants.findById(input.tenantId);

    if (!tenant || tenant.status !== "active") {
      throw new ApplicationError("Tenant is not available", {
        code: "tenant_not_available",
        statusCode: 404
      });
    }

    const existingMessage = await this.repositories.messages.findByProviderMessageId(
      input.tenantId,
      input.provider,
      input.providerMessageId
    );

    if (existingMessage) {
      const conversation = await this.repositories.conversations.findById(existingMessage.conversationId);

      if (!conversation) {
        throw new ApplicationError("Conversation for duplicated message was not found", {
          code: "conversation_not_found",
          statusCode: 500
        });
      }

      const contact = await this.findContactByPhone(input.tenantId, input.from);

      if (!contact) {
        throw new ApplicationError("Contact for duplicated message was not found", {
          code: "contact_not_found",
          statusCode: 500
        });
      }

      return {
        contact,
        conversation,
        message: existingMessage,
        duplicate: true
      };
    }

    const contact = await this.findOrCreateContact(input);
    const conversation = await this.findOrCreateConversation(input.tenantId, contact.id, input.receivedAt);
    const message = await this.repositories.messages.create({
      id: createId(),
      tenantId: input.tenantId,
      conversationId: conversation.id,
      contactId: contact.id,
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      direction: "inbound",
      type: input.content.type,
      body: input.content.type === "text" ? input.content.text : input.content.caption ?? null,
      media:
        input.content.type === "text"
          ? null
          : {
              url: input.content.mediaUrl,
              providerMediaId: input.content.providerMediaId,
              mimeType: input.content.mimeType,
              filename: input.content.fileName,
              caption: input.content.caption
            },
      payloadRaw: input.payloadRaw,
      status: "received",
      sentAt: null,
      receivedAt: input.receivedAt
    });

    await this.repositories.conversations.touchLastMessageAt(conversation.id, input.receivedAt);

    const updatedConversation = {
      ...conversation,
      lastMessageAt: input.receivedAt
    };

    await this.webhookDispatchService.dispatchInboundMessage({
      tenant,
      contact,
      conversation: updatedConversation,
      message
    });

    return {
      contact,
      conversation: updatedConversation,
      message,
      duplicate: false
    };
  }

  private async findOrCreateContact(input: InboundProviderMessage): Promise<Contact> {
    const existingContact = await this.findContactByPhone(input.tenantId, input.from);

    if (!existingContact) {
      return this.repositories.contacts.create({
        id: createId(),
        tenantId: input.tenantId,
        phone: normalizeWhatsAppPhone(input.from),
        displayName: input.displayName,
        providerContactId: input.providerContactId
      });
    }

    if (
      existingContact.displayName !== input.displayName ||
      existingContact.providerContactId !== input.providerContactId
    ) {
      return this.repositories.contacts.updateDetails({
        id: existingContact.id,
        displayName: input.displayName,
        providerContactId: input.providerContactId
      });
    }

    return existingContact;
  }

  private async findContactByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    for (const candidate of getWhatsAppPhoneLookupCandidates(phone)) {
      const existingContact = await this.repositories.contacts.findByTenantAndPhone(tenantId, candidate);

      if (existingContact) {
        return existingContact;
      }
    }

    return null;
  }

  private async findOrCreateConversation(
    tenantId: string,
    contactId: string,
    receivedAt: Date
  ): Promise<Conversation> {
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
      startedAt: receivedAt,
      lastMessageAt: receivedAt
    });
  }
}
