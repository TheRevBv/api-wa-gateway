import { createHmac } from "node:crypto";

import { ApplicationError } from "../../src/application/errors/application-error";
import { ReceiveInboundMessageUseCase } from "../../src/application/use-cases/receive-inbound-message";
import { DefaultMetaWebhookService } from "../../src/infrastructure/providers/meta-webhook-service";
import {
  InMemoryRepositoryBundle,
  RecordingWebhookDispatchService,
  createProviderConnection,
  createTenant
} from "../support/in-memory-dependencies";

const signPayload = (payload: string, secret: string): string =>
  `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

describe("DefaultMetaWebhookService", () => {
  it("verifies the webhook challenge for an active Meta connection", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.providerConnections.set(
      createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      })
    );
    const service = new DefaultMetaWebhookService(
      repositories.providerConnections,
      new ReceiveInboundMessageUseCase(repositories, new RecordingWebhookDispatchService())
    );

    const challenge = await service.verifyWebhook({
      connectionKey: "1234567890",
      mode: "subscribe",
      verifyToken: "verify-token",
      challenge: "challenge-123"
    });

    expect(challenge).toBe("challenge-123");
  });

  it("processes inbound text messages from Meta", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(
      createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      })
    );
    const webhookDispatchService = new RecordingWebhookDispatchService();
    const receiveInboundMessage = new ReceiveInboundMessageUseCase(repositories, webhookDispatchService);
    const service = new DefaultMetaWebhookService(repositories.providerConnections, receiveInboundMessage);
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: {
                  phone_number_id: "1234567890"
                },
                contacts: [
                  {
                    wa_id: "5215512345678",
                    profile: {
                      name: "Ada"
                    }
                  }
                ],
                messages: [
                  {
                    from: "5215512345678",
                    id: "wamid.abc",
                    timestamp: "1773331200",
                    type: "text",
                    text: {
                      body: "hola desde meta"
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    const result = await service.handleWebhookEvent({
      connectionKey: "1234567890",
      rawBody: body,
      signatureHeader: signPayload(body, "app-secret"),
      payload: JSON.parse(body)
    });

    expect(result).toEqual({
      processedMessages: 1,
      ignoredEvents: 0
    });
    expect(repositories.contacts.all()).toHaveLength(1);
    expect(repositories.messages.all()).toHaveLength(1);
    expect(repositories.messages.all()[0]?.provider).toBe("meta");
    expect(repositories.messages.all()[0]?.body).toBe("hola desde meta");
  });

  it("ignores status updates and unsupported webhook entries", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.tenants.set(createTenant());
    repositories.providerConnections.set(
      createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      })
    );
    const service = new DefaultMetaWebhookService(
      repositories.providerConnections,
      new ReceiveInboundMessageUseCase(repositories, new RecordingWebhookDispatchService())
    );
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: {
                  phone_number_id: "1234567890"
                },
                statuses: [
                  {
                    id: "wamid.abc",
                    status: "delivered"
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    const result = await service.handleWebhookEvent({
      connectionKey: "1234567890",
      rawBody: body,
      signatureHeader: signPayload(body, "app-secret"),
      payload: JSON.parse(body)
    });

    expect(result).toEqual({
      processedMessages: 0,
      ignoredEvents: 1
    });
  });

  it("rejects invalid signatures", async () => {
    const repositories = new InMemoryRepositoryBundle();
    repositories.providerConnections.set(
      createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      })
    );
    const service = new DefaultMetaWebhookService(
      repositories.providerConnections,
      new ReceiveInboundMessageUseCase(repositories, new RecordingWebhookDispatchService())
    );

    await expect(
      service.handleWebhookEvent({
        connectionKey: "1234567890",
        rawBody: "{}",
        signatureHeader: "sha256=invalid",
        payload: {}
      })
    ).rejects.toMatchObject({
      code: "meta_webhook_signature_invalid",
      statusCode: 401
    });
  });
});
