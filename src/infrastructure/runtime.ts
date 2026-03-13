import type { Logger } from "pino";

import { DefaultWebhookDispatchService } from "../application/services/webhook-delivery-service";
import type { MetaWebhookService } from "../application/ports/meta-webhook-service";
import { GetConversationUseCase } from "../application/use-cases/get-conversation";
import { ListConversationMessagesUseCase } from "../application/use-cases/list-conversation-messages";
import { ListConversationsUseCase } from "../application/use-cases/list-conversations";
import { ReceiveInboundMessageUseCase } from "../application/use-cases/receive-inbound-message";
import { SendOutboundMessageUseCase } from "../application/use-cases/send-outbound-message";
import type { BaileysSessionViewService } from "../application/ports/baileys-session-view";
import type { ProviderRuntime } from "../application/ports/whatsapp-provider";
import type { Environment } from "../config/env";
import { createDatabaseConnection } from "./database/client";
import { BaileysWhatsAppProvider } from "./providers/baileys-whatsapp-provider";
import { DefaultMetaWebhookService } from "./providers/meta-webhook-service";
import { MetaWhatsAppProvider } from "./providers/meta-whatsapp-provider";
import { DefaultWhatsAppProviderRegistry } from "./providers/provider-registry";
import {
  PostgresContactRepository,
  PostgresConversationRepository,
  PostgresMessageRepository
} from "./repositories/postgres-messaging-repositories";
import { PostgresTenantRepository, PostgresProviderConnectionRepository } from "./repositories/postgres-tenant-provider-repositories";
import {
  PostgresWebhookDispatchRepository,
  PostgresWebhookSubscriptionRepository
} from "./repositories/postgres-webhook-repositories";
import { FetchWebhookHttpClient } from "./webhooks/fetch-webhook-http-client";

export interface RuntimeServices {
  sendOutboundMessage: SendOutboundMessageUseCase;
  listConversations: ListConversationsUseCase;
  getConversation: GetConversationUseCase;
  listConversationMessages: ListConversationMessagesUseCase;
  metaWebhookService: MetaWebhookService;
  baileysSessionView: BaileysSessionViewService;
  baileysDashboardAuthToken: string;
}

export interface RuntimeContext {
  services: RuntimeServices;
  providerRuntimes: ProviderRuntime[];
  close(): Promise<void>;
}

export const createRuntimeContext = (env: Environment, logger: Logger): RuntimeContext => {
  const connection = createDatabaseConnection(env.DATABASE_URL);
  const repositories = {
    tenants: new PostgresTenantRepository(connection.db),
    contacts: new PostgresContactRepository(connection.db),
    conversations: new PostgresConversationRepository(connection.db),
    messages: new PostgresMessageRepository(connection.db),
    providerConnections: new PostgresProviderConnectionRepository(connection.db),
    webhookSubscriptions: new PostgresWebhookSubscriptionRepository(connection.db),
    webhookDispatches: new PostgresWebhookDispatchRepository(connection.db)
  };
  const webhookClient = new FetchWebhookHttpClient();
  const webhookDispatchService = new DefaultWebhookDispatchService(
    repositories.webhookSubscriptions,
    repositories.webhookDispatches,
    webhookClient,
    {
      timeoutMs: env.WEBHOOK_TIMEOUT_MS,
      retryAttempts: env.WEBHOOK_RETRY_ATTEMPTS
    }
  );
  const receiveInboundMessage = new ReceiveInboundMessageUseCase(repositories, webhookDispatchService);
  const baileysProvider = new BaileysWhatsAppProvider(
    repositories.providerConnections,
    receiveInboundMessage,
    {
      enabled: env.ENABLE_BAILEYS,
      authDir: env.BAILEYS_AUTH_DIR
    },
    logger
  );
  const metaProvider = new MetaWhatsAppProvider();
  const metaWebhookService = new DefaultMetaWebhookService(
    repositories.providerConnections,
    receiveInboundMessage
  );
  const providerRegistry = new DefaultWhatsAppProviderRegistry([baileysProvider, metaProvider]);

  return {
    services: {
      sendOutboundMessage: new SendOutboundMessageUseCase(repositories, providerRegistry),
      listConversations: new ListConversationsUseCase(repositories),
      getConversation: new GetConversationUseCase(repositories),
      listConversationMessages: new ListConversationMessagesUseCase(repositories),
      metaWebhookService,
      baileysSessionView: baileysProvider,
      baileysDashboardAuthToken: env.BAILEYS_DASHBOARD_AUTH_TOKEN
    },
    providerRuntimes: [baileysProvider],
    close: async () => {
      await Promise.all([baileysProvider.stop(), connection.pool.end()]);
    }
  };
};
