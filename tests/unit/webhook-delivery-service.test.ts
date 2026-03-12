import { DefaultWebhookDispatchService } from "../../src/application/services/webhook-delivery-service";
import {
  InMemoryWebhookDispatchRepository,
  InMemoryWebhookSubscriptionRepository,
  createWebhookSubscription
} from "../support/in-memory-dependencies";

describe("DefaultWebhookDispatchService", () => {
  it("marks the dispatch as succeeded when the webhook answers 2xx", async () => {
    const subscriptionRepository = new InMemoryWebhookSubscriptionRepository();
    const dispatchRepository = new InMemoryWebhookDispatchRepository();
    subscriptionRepository.set(createWebhookSubscription());

    const service = new DefaultWebhookDispatchService(
      subscriptionRepository,
      dispatchRepository,
      {
        postJson: vi.fn().mockResolvedValue({
          statusCode: 200,
          body: {
            ok: true
          }
        })
      },
      {
        timeoutMs: 1000,
        retryAttempts: 1
      }
    );

    await service.dispatchInboundMessage({
      tenant: {
        id: "tenant-1",
        name: "Tenant 1",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      contact: {
        id: "contact-1",
        tenantId: "tenant-1",
        phone: "5215512345678",
        displayName: "Ada",
        providerContactId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      conversation: {
        id: "conversation-1",
        tenantId: "tenant-1",
        contactId: "contact-1",
        channel: "whatsapp",
        status: "active",
        startedAt: new Date(),
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      message: {
        id: "message-1",
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        contactId: "contact-1",
        provider: "baileys",
        providerMessageId: "provider-message-1",
        direction: "inbound",
        type: "text",
        body: "hola",
        media: null,
        payloadRaw: {},
        status: "received",
        sentAt: null,
        receivedAt: new Date(),
        createdAt: new Date()
      }
    });

    expect(dispatchRepository.all()).toHaveLength(1);
    expect(dispatchRepository.all()[0]?.status).toBe("succeeded");
    expect(dispatchRepository.all()[0]?.attempts).toBe(1);
  });

  it("retries once and marks the dispatch as failed when the webhook never succeeds", async () => {
    const subscriptionRepository = new InMemoryWebhookSubscriptionRepository();
    const dispatchRepository = new InMemoryWebhookDispatchRepository();
    const postJson = vi.fn().mockResolvedValue({
      statusCode: 500,
      body: {
        ok: false
      }
    });

    subscriptionRepository.set(createWebhookSubscription());

    const service = new DefaultWebhookDispatchService(
      subscriptionRepository,
      dispatchRepository,
      {
        postJson
      },
      {
        timeoutMs: 1000,
        retryAttempts: 1
      }
    );

    await service.dispatchInboundMessage({
      tenant: {
        id: "tenant-1",
        name: "Tenant 1",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      contact: {
        id: "contact-1",
        tenantId: "tenant-1",
        phone: "5215512345678",
        displayName: "Ada",
        providerContactId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      conversation: {
        id: "conversation-1",
        tenantId: "tenant-1",
        contactId: "contact-1",
        channel: "whatsapp",
        status: "active",
        startedAt: new Date(),
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      message: {
        id: "message-1",
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        contactId: "contact-1",
        provider: "baileys",
        providerMessageId: "provider-message-1",
        direction: "inbound",
        type: "text",
        body: "hola",
        media: null,
        payloadRaw: {},
        status: "received",
        sentAt: null,
        receivedAt: new Date(),
        createdAt: new Date()
      }
    });

    expect(postJson).toHaveBeenCalledTimes(2);
    expect(dispatchRepository.all()[0]?.status).toBe("failed");
    expect(dispatchRepository.all()[0]?.attempts).toBe(2);
  });
});
