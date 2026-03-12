import type { BaileysSessionViewService } from "../../../application/ports/baileys-session-view";
import type { GetConversationUseCase } from "../../../application/use-cases/get-conversation";
import type { ListConversationMessagesUseCase } from "../../../application/use-cases/list-conversation-messages";
import type { ListConversationsUseCase } from "../../../application/use-cases/list-conversations";
import type { SendOutboundMessageUseCase } from "../../../application/use-cases/send-outbound-message";

export interface HttpRouteDependencies {
  sendOutboundMessage: SendOutboundMessageUseCase;
  listConversations: ListConversationsUseCase;
  getConversation: GetConversationUseCase;
  listConversationMessages: ListConversationMessagesUseCase;
  baileysSessionView: BaileysSessionViewService;
  baileysDashboardAuthToken: string;
}
