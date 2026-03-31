import type { MessageWithConversationContext } from "./repositories";
import type { MessageStatus } from "../../domain/messaging/message";

export interface WebhookDispatchService {
  dispatchInboundMessage(context: MessageWithConversationContext): Promise<void>;
  dispatchMessageStatusUpdated(input: {
    context: MessageWithConversationContext;
    previousStatus: MessageStatus;
  }): Promise<void>;
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
