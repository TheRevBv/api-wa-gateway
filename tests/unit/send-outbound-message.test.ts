import { ApplicationError } from "../../src/application/errors/application-error";
import { SendOutboundMessageUseCase } from "../../src/application/use-cases/send-outbound-message";
import {
  FakeWhatsAppProvider,
  FakeWhatsAppProviderRegistry,
  InMemoryRepositoryBundle,
  createProviderConnection,
  createTenant
} from "../support/in-memory-dependencies";

describe("SendOutboundMessageUseCase", () => {
  it("sends the outbound message and persists the result", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(createProviderConnection());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const provider = new FakeWhatsAppProvider();
    const useCase = new SendOutboundMessageUseCase(
      repositories,
      new FakeWhatsAppProviderRegistry(provider)
    );

    const result = await useCase.execute({
      tenantId: "tenant-1",
      to: "5215512345678",
      content: {
        type: "text",
        text: "hola outbound"
      }
    });

    expect(provider.sentCommands).toHaveLength(1);
    expect(result.message.direction).toBe("outbound");
    expect(result.message.status).toBe("sent");
    expect(repositories.contacts.all()).toHaveLength(1);
    expect(repositories.conversations.all()).toHaveLength(1);
    expect(repositories.messages.all()).toHaveLength(1);
  });

  it("persists accepted template messages when the provider reports accepted", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(createProviderConnection({ provider: "meta" }));
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const provider = new FakeWhatsAppProvider();
    provider.nextResult = {
      providerMessageId: "wamid.template-1",
      payloadRaw: { ok: true, message_status: "accepted" },
      status: "accepted",
      sentAt: new Date("2026-01-01T00:00:00.000Z")
    };

    const useCase = new SendOutboundMessageUseCase(
      repositories,
      new FakeWhatsAppProviderRegistry(provider)
    );

    const result = await useCase.execute({
      tenantId: "tenant-1",
      to: "524792348066",
      content: {
        type: "template",
        name: "hello_world",
        languageCode: "en_US"
      }
    });

    expect(result.message.status).toBe("accepted");
    expect(result.message.type).toBe("template");
    expect(result.message.body).toBe("hello_world");
    expect(result.message.media).toBeNull();
  });

  it("fails when there is no provider connection", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const useCase = new SendOutboundMessageUseCase(
      repositories,
      new FakeWhatsAppProviderRegistry(new FakeWhatsAppProvider())
    );

    await expect(
      useCase.execute({
        tenantId: "tenant-1",
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola"
        }
      })
    ).rejects.toMatchObject({
      code: "provider_connection_not_found",
      statusCode: 409
    });
  });

  it("fails when the provider returns a failed status", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(createProviderConnection());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const provider = new FakeWhatsAppProvider();
    provider.nextResult = {
      providerMessageId: null,
      payloadRaw: { error: "read ETIMEDOUT" },
      status: "failed",
      sentAt: null
    };

    const useCase = new SendOutboundMessageUseCase(
      repositories,
      new FakeWhatsAppProviderRegistry(provider)
    );

    await expect(
      useCase.execute({
        tenantId: "tenant-1",
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola"
        }
      })
    ).rejects.toMatchObject({
      code: "provider_send_failed",
      statusCode: 502,
      message: "Provider rejected the outbound message: read ETIMEDOUT"
    });
    expect(repositories.messages.all()).toHaveLength(1);
    expect(repositories.messages.all()[0]?.status).toBe("failed");
  });

  it("persists a failed attempt when the provider throws an application error", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(createProviderConnection());
    repositories.conversations.listByTenant = repositories.listConversations.bind(repositories);

    const provider = new FakeWhatsAppProvider();
    provider.nextError = new ApplicationError("Baileys session is not ready to send messages", {
      code: "provider_unavailable",
      statusCode: 503
    });

    const useCase = new SendOutboundMessageUseCase(
      repositories,
      new FakeWhatsAppProviderRegistry(provider)
    );

    await expect(
      useCase.execute({
        tenantId: "tenant-1",
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola"
        }
      })
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      statusCode: 503
    });

    expect(repositories.messages.all()).toHaveLength(1);
    expect(repositories.messages.all()[0]?.status).toBe("failed");
    expect(repositories.messages.all()[0]?.payloadRaw).toMatchObject({
      code: "provider_unavailable"
    });
  });
});
