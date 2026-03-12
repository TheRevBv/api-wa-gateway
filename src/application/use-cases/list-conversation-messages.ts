import { ApplicationError } from "../errors/application-error";
import type { PaginatedResult, PaginationQuery, RepositoryBundle } from "../ports/repositories";
import type { Message } from "../../domain/messaging/message";

export class ListConversationMessagesUseCase {
  constructor(private readonly repositories: RepositoryBundle) {}

  async execute(
    tenantId: string,
    conversationId: string,
    query: PaginationQuery
  ): Promise<PaginatedResult<Message>> {
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

    return this.repositories.messages.listByConversation(tenantId, conversationId, query);
  }
}
