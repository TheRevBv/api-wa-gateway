export type WebhookDispatchStatus = "pending" | "succeeded" | "failed";

export interface WebhookDispatch {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  subscriptionId: string;
  requestPayload: unknown;
  responsePayload: unknown;
  status: WebhookDispatchStatus;
  responseCode: number | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}
