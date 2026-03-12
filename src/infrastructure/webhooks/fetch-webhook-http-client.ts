import type { WebhookHttpClient, WebhookHttpRequest } from "../../application/ports/webhook-dispatcher";

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export class FetchWebhookHttpClient implements WebhookHttpClient {
  async postJson(request: WebhookHttpRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal
      });

      return {
        statusCode: response.status,
        body: await parseResponseBody(response)
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
