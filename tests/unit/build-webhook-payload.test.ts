import { buildInboundMessageWebhookPayload } from "../../src/application/services/build-webhook-payload";
import { createTenant } from "../support/in-memory-dependencies";

describe("buildInboundMessageWebhookPayload", () => {
  it("builds the standard payload shape for inbound messages", () => {
    const tenant = createTenant();
    const payload = buildInboundMessageWebhookPayload({
      tenant,
      contact: {
        id: "contact-1",
        tenantId: tenant.id,
        phone: "5215512345678",
        displayName: "Ada",
        providerContactId: "5215512345678@s.whatsapp.net",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      },
      conversation: {
        id: "conversation-1",
        tenantId: tenant.id,
        contactId: "contact-1",
        channel: "whatsapp",
        status: "active",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        lastMessageAt: new Date("2026-01-01T00:00:01.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:01.000Z")
      },
      message: {
        id: "message-1",
        tenantId: tenant.id,
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
        receivedAt: new Date("2026-01-01T00:00:01.000Z"),
        createdAt: new Date("2026-01-01T00:00:01.000Z")
      }
    });

    expect(payload.event).toBe("message.received");
    expect(payload.tenant.id).toBe(tenant.id);
    expect(payload.contact.phone).toBe("5215512345678");
    expect(payload.message.type).toBe("text");
  });
});
