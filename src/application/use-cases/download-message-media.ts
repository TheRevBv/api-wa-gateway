import { ApplicationError } from "../errors/application-error";
import type { RepositoryBundle } from "../ports/repositories";
import type {
  ProviderDownloadMediaResult,
  WhatsAppProviderRegistry
} from "../ports/whatsapp-provider";

export class DownloadMessageMediaUseCase {
  constructor(
    private readonly repositories: RepositoryBundle,
    private readonly providerRegistry: WhatsAppProviderRegistry
  ) {}

  async execute(tenantId: string, messageId: string): Promise<ProviderDownloadMediaResult> {
    const tenant = await this.repositories.tenants.findById(tenantId);

    if (!tenant || tenant.status !== "active") {
      throw new ApplicationError("Tenant is not available", {
        code: "tenant_not_available",
        statusCode: 404
      });
    }

    const context = await this.repositories.messages.findContextByMessageId(messageId);

    if (!context || context.tenant.id !== tenantId) {
      throw new ApplicationError("Message was not found", {
        code: "message_not_found",
        statusCode: 404
      });
    }

    if (
      context.message.direction !== "inbound" ||
      !context.message.media?.providerMediaId ||
      (context.message.type !== "image" && context.message.type !== "document")
    ) {
      throw new ApplicationError("Message media was not found", {
        code: "message_media_not_found",
        statusCode: 404
      });
    }

    const connection = await this.repositories.providerConnections.findActiveByTenantIdAndProvider(
      tenantId,
      context.message.provider
    );

    if (!connection) {
      throw new ApplicationError("Provider connection is not available", {
        code: "provider_connection_not_available",
        statusCode: 404
      });
    }

    const provider = this.providerRegistry.get(context.message.provider);

    return provider.downloadMedia({
      connection,
      providerMediaId: context.message.media.providerMediaId,
      fallbackMimeType: context.message.media.mimeType,
      fallbackFileName: context.message.media.filename ?? `media-${context.message.id}`
    });
  }
}
