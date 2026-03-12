import { ApplicationError } from "../errors/application-error";
import type { RepositoryBundle } from "../ports/repositories";

export class GetConversationUseCase {
  constructor(private readonly repositories: RepositoryBundle) {}

  async execute(tenantId: string, conversationId: string) {
    const tenant = await this.repositories.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      throw new ApplicationError("Tenant is not available", {
        code: "tenant_not_available",
        statusCode: 404
      });
    }

    const conversation = await this.repositories.conversations.findById(conversationId);

    if (!conversation || conversation.tenantId !== tenantId) {
      throw new ApplicationError("Conversation was not found", {
        code: "conversation_not_found",
        statusCode: 404
      });
    }

    const contact = await this.repositories.contacts.findById(conversation.contactId);

    if (!contact || contact.tenantId !== tenantId) {
      throw new ApplicationError("Conversation contact was not found", {
        code: "contact_not_found",
        statusCode: 404
      });
    }

    return {
      conversation,
      contact
    };
  }
}
