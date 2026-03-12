import type { ProviderName } from "../providers/provider-connection";

export type MessageDirection = "inbound" | "outbound";
export type MessageType = "text" | "image" | "document";
export type MessageStatus = "received" | "sent" | "failed";

export interface MessageMedia {
  url: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
}

export interface TextMessageContent {
  type: "text";
  text: string;
}

export interface ImageMessageContent {
  type: "image";
  mediaUrl: string;
  mimeType?: string;
  caption?: string;
  fileName?: string;
}

export interface DocumentMessageContent {
  type: "document";
  mediaUrl: string;
  mimeType?: string;
  caption?: string;
  fileName: string;
}

export type MessageContent =
  | TextMessageContent
  | ImageMessageContent
  | DocumentMessageContent;

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string;
  provider: ProviderName;
  providerMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  media: MessageMedia | null;
  payloadRaw: unknown;
  status: MessageStatus;
  sentAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
}
