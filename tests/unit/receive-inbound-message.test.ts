import { ApplicationError } from "../../src/application/errors/application-error";
import { ReceiveInboundMessageUseCase } from "../../src/application/use-cases/receive-inbound-message";
import {
  InMemoryRepositoryBundle,
  RecordingWebhookDispatchService,
  createTenant
} from "../support/in-memory-dependencies";

describe("ReceiveInboundMessageUseCase", () => {
  it("creates contact, conversation and message and dispatches the webhook", async () => {
    const repositories = new InMemoryRepositoryBundle();
    const webhookDispatchService = new RecordingWebhookDispatchService();
    repositories.tenants.set(createTenant());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const useCase = new ReceiveInboundMessageUseCase(repositories, webhookDispatchService);

    const result = await useCase.execute({
      tenantId: "tenant-1",
      provider: "baileys",
      providerMessageId: "provider-message-1",
      providerContactId: "5215512345678@s.whatsapp.net",
      from: "5215512345678",
      displayName: "Ada",
      content: {
        type: "text",
        text: "hola"
      },
      payloadRaw: {
        raw: true
      },
      receivedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(result.duplicate).toBe(false);
    expect(result.contact.phone).toBe("5215512345678");
    expect(result.conversation.channel).toBe("whatsapp");
    expect(result.message.direction).toBe("inbound");
    expect(repositories.contacts.all()).toHaveLength(1);
    expect(repositories.conversations.all()).toHaveLength(1);
    expect(repositories.messages.all()).toHaveLength(1);
    expect(webhookDispatchService.dispatchedContexts).toHaveLength(1);
  });

  it("returns duplicated message without creating new records", async () => {
    const repositories = new InMemoryRepositoryBundle();
    const webhookDispatchService = new RecordingWebhookDispatchService();
    repositories.tenants.set(createTenant());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const useCase = new ReceiveInboundMessageUseCase(repositories, webhookDispatchService);
    const input = {
      tenantId: "tenant-1",
      provider: "baileys" as const,
      providerMessageId: "provider-message-1",
      providerContactId: "5215512345678@s.whatsapp.net",
      from: "5215512345678",
      displayName: "Ada",
      content: {
        type: "text" as const,
        text: "hola"
      },
      payloadRaw: {
        raw: true
      },
      receivedAt: new Date("2026-01-01T00:00:00.000Z")
    };

    await useCase.execute(input);
    const duplicated = await useCase.execute(input);

    expect(duplicated.duplicate).toBe(true);
    expect(repositories.messages.all()).toHaveLength(1);
    expect(webhookDispatchService.dispatchedContexts).toHaveLength(1);
  });

  it("fails when the tenant is inactive", async () => {
    const repositories = new InMemoryRepositoryBundle();
    const webhookDispatchService = new RecordingWebhookDispatchService();
    repositories.tenants.set(createTenant({ status: "inactive" }));
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const useCase = new ReceiveInboundMessageUseCase(repositories, webhookDispatchService);

    await expect(
      useCase.execute({
        tenantId: "tenant-1",
        provider: "baileys",
        providerMessageId: "provider-message-1",
        providerContactId: null,
        from: "5215512345678",
        displayName: null,
        content: {
          type: "text",
          text: "hola"
        },
        payloadRaw: {},
        receivedAt: new Date()
      })
    ).rejects.toMatchObject({
      code: "tenant_not_available",
      statusCode: 404
    });
  });
});
