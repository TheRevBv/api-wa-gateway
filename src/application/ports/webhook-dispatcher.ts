import type { MessageWithConversationContext } from "./repositories";

export interface WebhookDispatchService {
  dispatchInboundMessage(context: MessageWithConversationContext): Promise<void>;
}

export interface WebhookHttpRequest {
  url: string;
  timeoutMs: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface WebhookHttpResponse {
  statusCode: number;
  body: unknown;
}

export interface WebhookHttpClient {
  postJson(request: WebhookHttpRequest): Promise<WebhookHttpResponse>;
}
