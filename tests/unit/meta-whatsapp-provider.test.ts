import { ApplicationError } from "../../src/application/errors/application-error";
import { MetaCloudApiClient } from "../../src/infrastructure/providers/meta-cloud-api-client";
import { MetaWhatsAppProvider } from "../../src/infrastructure/providers/meta-whatsapp-provider";
import { createProviderConnection } from "../support/in-memory-dependencies";

describe("MetaWhatsAppProvider", () => {
  it("maps text messages to the Cloud API payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ id: "wamid.123" }]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const provider = new MetaWhatsAppProvider(new MetaCloudApiClient(fetchMock as typeof fetch));

    const result = await provider.sendMessage({
      connection: createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      }),
      to: "5215512345678",
      content: {
        type: "text",
        text: "hola meta"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5215512345678",
      type: "text",
      text: {
        body: "hola meta"
      }
    });
    expect(result.providerMessageId).toBe("wamid.123");
    expect(result.status).toBe("sent");
  });

  it("maps document messages with filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ id: "wamid.456" }]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const provider = new MetaWhatsAppProvider(new MetaCloudApiClient(fetchMock as typeof fetch));

    await provider.sendMessage({
      connection: createProviderConnection({
        provider: "meta",
        connectionKey: "1234567890",
        config: {
          accessToken: "meta-token",
          verifyToken: "verify-token",
          appSecret: "app-secret",
          apiVersion: "v23.0"
        }
      }),
      to: "5215512345678",
      content: {
        type: "document",
        mediaUrl: "https://example.com/test.pdf",
        fileName: "test.pdf",
        caption: "demo document"
      }
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5215512345678",
      type: "document",
      document: {
        link: "https://example.com/test.pdf",
        caption: "demo document",
        filename: "test.pdf"
      }
    });
  });

  it("surfaces Meta API errors as provider failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Unsupported post request"
          }
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const provider = new MetaWhatsAppProvider(new MetaCloudApiClient(fetchMock as typeof fetch));

    await expect(
      provider.sendMessage({
        connection: createProviderConnection({
          provider: "meta",
          connectionKey: "1234567890",
          config: {
            accessToken: "meta-token",
            verifyToken: "verify-token",
            appSecret: "app-secret",
            apiVersion: "v23.0"
          }
        }),
        to: "5215512345678",
        content: {
          type: "text",
          text: "hola meta"
        }
      })
    ).rejects.toMatchObject({
      code: "provider_send_failed",
      statusCode: 502,
      message: "Meta rejected the outbound message: Unsupported post request"
    });
  });
});
