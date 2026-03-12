import { ApplicationError } from "../errors/application-error";
import type { PaginatedResult, ConversationListItem, PaginationQuery, RepositoryBundle } from "../ports/repositories";

export class ListConversationsUseCase {
  constructor(private readonly repositories: RepositoryBundle) {}

  async execute(tenantId: string, query: PaginationQuery): Promise<PaginatedResult<ConversationListItem>> {
    const tenant = await this.repositories.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      throw new ApplicationError("Tenant is not available", {
        code: "tenant_not_available",
        statusCode: 404
      });
    }

    return this.repositories.conversations.listByTenant(tenantId, query);
  }
}
