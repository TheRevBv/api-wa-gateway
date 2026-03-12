import type { MessageContent } from "../../domain/messaging/message";
import type { ProviderConnection, ProviderName } from "../../domain/providers/provider-connection";

export interface InboundProviderMessage {
  tenantId: string;
  provider: ProviderName;
  providerMessageId: string;
  providerContactId: string | null;
  from: string;
  displayName: string | null;
  content: MessageContent;
  payloadRaw: unknown;
  receivedAt: Date;
}

export interface ProviderSendMessageCommand {
  connection: ProviderConnection;
  to: string;
  content: MessageContent;
}

export interface ProviderSendMessageResult {
  providerMessageId: string | null;
  payloadRaw: unknown;
  status: "sent" | "failed";
  sentAt: Date | null;
}

export interface WhatsAppProvider {
  readonly providerName: ProviderName;
  sendMessage(command: ProviderSendMessageCommand): Promise<ProviderSendMessageResult>;
}

export interface ProviderRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface WhatsAppProviderRegistry {
  get(providerName: ProviderName): WhatsAppProvider;
}
