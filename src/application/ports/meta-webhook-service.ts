export interface MetaWebhookVerificationInput {
  connectionKey: string;
  mode?: string;
  verifyToken?: string;
  challenge?: string;
}

export interface MetaWebhookEventInput {
  connectionKey: string;
  rawBody: string;
  signatureHeader?: string;
  payload: unknown;
}

export interface MetaWebhookEventResult {
  processedMessages: number;
  processedStatuses: number;
  ignoredEvents: number;
}

export interface MetaWebhookService {
  verifyWebhook(input: MetaWebhookVerificationInput): Promise<string>;
  handleWebhookEvent(input: MetaWebhookEventInput): Promise<MetaWebhookEventResult>;
}
