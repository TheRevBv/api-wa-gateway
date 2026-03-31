import { MetaCloudApiClient } from "../../src/infrastructure/providers/meta-cloud-api-client";

describe("MetaCloudApiClient provider templates", () => {
  it("publishes a Meta template with body examples", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "meta-template-1",
          name: "campaign_notice",
          language: "es_MX",
          status: "PENDING",
          category: "UTILITY"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const client = new MetaCloudApiClient(fetchMock as typeof fetch);

    const result = await client.createTemplate({
      accessToken: "meta-token",
      apiVersion: "v25.0",
      baseUrl: "https://graph.facebook.com",
      whatsappBusinessAccountId: "waba-123",
      name: "campaign_notice",
      languageCode: "es_MX",
      category: "UTILITY",
      bodyText: "Hola {{1}}",
      exampleValues: ["Joshua"]
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://graph.facebook.com/v25.0/waba-123/message_templates");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "campaign_notice",
      language: "es_MX",
      category: "UTILITY",
      components: [
        {
          type: "BODY",
          text: "Hola {{1}}",
          example: {
            body_text: [["Joshua"]]
          }
        }
      ]
    });
    expect(result).toMatchObject({
      id: "meta-template-1",
      name: "campaign_notice",
      languageCode: "es_MX",
      status: "PENDING",
      category: "UTILITY"
    });
  });

  it("accepts create responses that only return id, status and category", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "meta-template-2",
          status: "PENDING",
          category: "UTILITY"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const client = new MetaCloudApiClient(fetchMock as typeof fetch);

    const result = await client.createTemplate({
      accessToken: "meta-token",
      apiVersion: "v25.0",
      baseUrl: "https://graph.facebook.com",
      whatsappBusinessAccountId: "waba-123",
      name: "campaign_notice_minimal",
      languageCode: "es_MX",
      category: "UTILITY",
      bodyText: "Hola {{1}}",
      exampleValues: ["Joshua"]
    });

    expect(result).toMatchObject({
      id: "meta-template-2",
      name: "campaign_notice_minimal",
      languageCode: "es_MX",
      status: "PENDING",
      category: "UTILITY"
    });
  });

  it("looks up Meta templates by name and filters by language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "meta-template-1",
              name: "campaign_notice",
              language: "es_MX",
              status: "APPROVED",
              category: "UTILITY"
            },
            {
              id: "meta-template-2",
              name: "campaign_notice",
              language: "en_US",
              status: "APPROVED",
              category: "UTILITY"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    const client = new MetaCloudApiClient(fetchMock as typeof fetch);

    const result = await client.findTemplatesByName({
      accessToken: "meta-token",
      apiVersion: "v25.0",
      baseUrl: "https://graph.facebook.com",
      whatsappBusinessAccountId: "waba-123",
      name: "campaign_notice",
      languageCode: "es_MX"
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://graph.facebook.com/v25.0/waba-123/message_templates?name=campaign_notice"
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "meta-template-1",
      languageCode: "es_MX"
    });
  });
});
