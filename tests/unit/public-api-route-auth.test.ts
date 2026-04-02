import pino from "pino";

import { buildApp } from "../../src/app";
import type { HttpRouteDependencies } from "../../src/interfaces/http/routes/dependencies";

const now = new Date("2026-01-01T00:00:00.000Z");

function createDependencies(token: string): HttpRouteDependencies {
  const sendOutboundMessage = {
    execute: vi.fn(async () => ({
      contact: {
        id: "contact-1",
        tenantId: "tenant-1",
        phone: "5215512345678",
        displayName: "Josh",
        providerContactId: null,
        createdAt: now,
        updatedAt: now
      },
      conversation: {
        id: "conversation-1",
        tenantId: "tenant-1",
        contactId: "contact-1",
        channel: "whatsapp",
        status: "active",
        startedAt: now,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now
      },
      message: {
        id: "message-1",
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        contactId: "contact-1",
        provider: "meta",
        providerMessageId: "wamid.1",
        direction: "outbound",
        type: "text",
        body: "hola",
        media: null,
        payloadRaw: { ok: true },
        status: "sent",
        sentAt: now,
        receivedAt: null,
        createdAt: now
      }
    }))
  };

  const listConversations = {
    execute: vi.fn(async () => ({
      items: [
        {
          conversation: {
            id: "conversation-1",
            tenantId: "tenant-1",
            contactId: "contact-1",
            channel: "whatsapp",
            status: "active",
            startedAt: now,
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now
          },
          contact: {
            id: "contact-1",
            tenantId: "tenant-1",
            phone: "5215512345678",
            displayName: "Josh",
            providerContactId: null,
            createdAt: now,
            updatedAt: now
          }
        }
      ],
      total: 1,
      limit: 20,
      offset: 0
    }))
  };

  return {
    sendOutboundMessage: sendOutboundMessage as unknown as HttpRouteDependencies["sendOutboundMessage"],
    listConversations: listConversations as unknown as HttpRouteDependencies["listConversations"],
    getConversation: { execute: vi.fn() } as unknown as HttpRouteDependencies["getConversation"],
    listConversationMessages: { execute: vi.fn() } as unknown as HttpRouteDependencies["listConversationMessages"],
    downloadMessageMedia: { execute: vi.fn() } as unknown as HttpRouteDependencies["downloadMessageMedia"],
    metaProviderTemplateManagement: {} as HttpRouteDependencies["metaProviderTemplateManagement"],
    metaWebhookService: {} as HttpRouteDependencies["metaWebhookService"],
    baileysSessionView: {} as HttpRouteDependencies["baileysSessionView"],
    baileysDashboardAuthToken: "",
    gatewaySharedSecret: "",
    gatewayPublicApiBearerToken: token
  };
}

describe("public API bearer auth", () => {
  it("rejects public message dispatch without the bearer token", async () => {
    const dependencies = createDependencies("top-secret");
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tenants/tenant-1/messages",
      payload: {
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola"
        }
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "invalid_public_api_token",
        message: "Public API bearer token is invalid"
      }
    });
    expect(dependencies.sendOutboundMessage.execute).not.toHaveBeenCalled();

    await app.close();
  });

  it("accepts public message dispatch with the expected bearer token", async () => {
    const dependencies = createDependencies("top-secret");
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tenants/tenant-1/messages",
      headers: {
        authorization: "Bearer top-secret"
      },
      payload: {
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola"
        }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(dependencies.sendOutboundMessage.execute).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it("rejects conversation listing without the bearer token", async () => {
    const dependencies = createDependencies("top-secret");
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/tenant-1/conversations"
    });

    expect(response.statusCode).toBe(401);
    expect(dependencies.listConversations.execute).not.toHaveBeenCalled();

    await app.close();
  });

  it("accepts conversation listing with the expected bearer token", async () => {
    const dependencies = createDependencies("top-secret");
    const app = buildApp({
      logger: pino({ enabled: false }),
      dependencies
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tenants/tenant-1/conversations",
      headers: {
        authorization: "Bearer top-secret"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(dependencies.listConversations.execute).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
