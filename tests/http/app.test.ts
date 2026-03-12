import pino from "pino";

import { buildApp } from "../../src/app";
import { GetConversationUseCase } from "../../src/application/use-cases/get-conversation";
import { ListConversationMessagesUseCase } from "../../src/application/use-cases/list-conversation-messages";
import { ListConversationsUseCase } from "../../src/application/use-cases/list-conversations";
import { SendOutboundMessageUseCase } from "../../src/application/use-cases/send-outbound-message";
import {
  FakeWhatsAppProvider,
  FakeWhatsAppProviderRegistry,
  InMemoryRepositoryBundle,
  createProviderConnection,
  createTenant
} from "../support/in-memory-dependencies";

describe("HTTP app", () => {
  it("sends a message and exposes the conversation history", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(createProviderConnection());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const provider = new FakeWhatsAppProvider();
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies: {
        sendOutboundMessage: new SendOutboundMessageUseCase(
          repositories,
          new FakeWhatsAppProviderRegistry(provider)
        ),
        listConversations: new ListConversationsUseCase(repositories),
        getConversation: new GetConversationUseCase(repositories),
        listConversationMessages: new ListConversationMessagesUseCase(repositories)
      }
    });

    const sendResponse = await app.inject({
      method: "POST",
      url: "/api/v1/tenants/tenant-1/messages",
      payload: {
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola desde test"
        }
      }
    });

    expect(sendResponse.statusCode).toBe(201);

    const conversationsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/tenant-1/conversations?limit=20&offset=0"
    });

    expect(conversationsResponse.statusCode).toBe(200);
    const conversationsBody = conversationsResponse.json();
    expect(conversationsBody.items).toHaveLength(1);

    const conversationId = conversationsBody.items[0]?.conversation.id as string;
    const messagesResponse = await app.inject({
      method: "GET",
      url: `/api/v1/tenants/tenant-1/conversations/${conversationId}/messages?limit=20&offset=0`
    });

    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json().items).toHaveLength(1);

    const invalidResponse = await app.inject({
      method: "POST",
      url: "/api/v1/tenants/tenant-1/messages",
      payload: {
        to: "",
        content: {
          type: "text",
          text: ""
        }
      }
    });

    expect(invalidResponse.statusCode).toBe(400);

    await app.close();
  });
});
