import type { BaileysSessionViewService } from "../../../application/ports/baileys-session-view";
import type { MetaWebhookService } from "../../../application/ports/meta-webhook-service";
import type { GetConversationUseCase } from "../../../application/use-cases/get-conversation";
import type { DownloadMessageMediaUseCase } from "../../../application/use-cases/download-message-media";
import type { ListConversationMessagesUseCase } from "../../../application/use-cases/list-conversation-messages";
import type { ListConversationsUseCase } from "../../../application/use-cases/list-conversations";
import type { SendOutboundMessageUseCase } from "../../../application/use-cases/send-outbound-message";
import type { MetaProviderTemplateManagementService } from "../../../infrastructure/providers/meta-provider-template-management-service";

export interface HttpRouteDependencies {
  sendOutboundMessage: SendOutboundMessageUseCase;
  listConversations: ListConversationsUseCase;
  getConversation: GetConversationUseCase;
  listConversationMessages: ListConversationMessagesUseCase;
  downloadMessageMedia: DownloadMessageMediaUseCase;
  metaProviderTemplateManagement: MetaProviderTemplateManagementService;
  metaWebhookService: MetaWebhookService;
  baileysSessionView: BaileysSessionViewService;
  baileysDashboardAuthToken: string;
  gatewaySharedSecret: string;
  gatewayPublicApiBearerToken: string;
}
