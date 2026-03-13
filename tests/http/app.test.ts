import pino from "pino";

import { buildApp } from "../../src/app";
import { GetConversationUseCase } from "../../src/application/use-cases/get-conversation";
import { ListConversationMessagesUseCase } from "../../src/application/use-cases/list-conversation-messages";
import { ListConversationsUseCase } from "../../src/application/use-cases/list-conversations";
import { SendOutboundMessageUseCase } from "../../src/application/use-cases/send-outbound-message";
import {
  FakeBaileysSessionViewService,
  FakeMetaWebhookService,
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
    const baileysSessionView = new FakeBaileysSessionViewService();
    const metaWebhookService = new FakeMetaWebhookService();
    baileysSessionView.sessions = [
      {
        connectionId: "connection-1",
        tenantId: "tenant-1",
        connectionKey: "tenant-1-session",
        displayName: "Tenant 1 Session",
        status: "qr_ready",
        qrCode: "qr-value",
        lastError: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      }
    ];
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies: {
        sendOutboundMessage: new SendOutboundMessageUseCase(
          repositories,
          new FakeWhatsAppProviderRegistry(provider)
        ),
        listConversations: new ListConversationsUseCase(repositories),
        getConversation: new GetConversationUseCase(repositories),
        listConversationMessages: new ListConversationMessagesUseCase(repositories),
        metaWebhookService,
        baileysSessionView,
        baileysDashboardAuthToken: "secret-token"
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

    const authPageResponse = await app.inject({
      method: "GET",
      url: "/auth/baileys?auth=secret-token"
    });

    expect(authPageResponse.statusCode).toBe(200);
    expect(authPageResponse.headers["content-type"]).toContain("text/html");
    expect(authPageResponse.body).toContain("Baileys Login Console");
    expect(authPageResponse.body).toContain("Tenant 1 Session");
    expect(authPageResponse.body).toContain("data:image/png;base64");

    const sessionsResponse = await app.inject({
      method: "GET",
      url: "/auth/baileys/sessions?auth=secret-token"
    });

    expect(sessionsResponse.statusCode).toBe(200);
    expect(sessionsResponse.json().items).toHaveLength(1);

    const unauthorizedResponse = await app.inject({
      method: "GET",
      url: "/auth/baileys/sessions?auth=wrong-token"
    });

    expect(unauthorizedResponse.statusCode).toBe(401);

    const verificationResponse = await app.inject({
      method: "GET",
      url: "/webhooks/meta/phone-number-1?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123"
    });

    expect(verificationResponse.statusCode).toBe(200);
    expect(verificationResponse.body).toBe("challenge-token");

    const webhookPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: []
    });
    const webhookResponse = await app.inject({
      method: "POST",
      url: "/webhooks/meta/phone-number-1",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=test"
      },
      payload: webhookPayload
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(webhookResponse.json()).toEqual({
      received: true,
      processedMessages: 1,
      ignoredEvents: 0
    });
    expect(metaWebhookService.verificationInputs).toHaveLength(1);
    expect(metaWebhookService.eventInputs[0]?.rawBody).toBe(webhookPayload);

    await app.close();
  });
});
