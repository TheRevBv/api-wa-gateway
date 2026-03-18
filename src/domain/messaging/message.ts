import type { ProviderName } from "../providers/provider-connection";

export type MessageDirection = "inbound" | "outbound";
export type MessageType = "text" | "image" | "document" | "template";
export type MessageStatus = "received" | "accepted" | "sent" | "delivered" | "read" | "failed";

export interface MessageMedia {
  url?: string;
  providerMediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
}

export interface TextMessageContent {
  type: "text";
  text: string;
  previewUrl?: boolean;
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

export interface TemplateMessageContent {
  type: "template";
  name: string;
  languageCode?: string;
}

export type MessageContent =
  | TextMessageContent
  | ImageMessageContent
  | DocumentMessageContent
  | TemplateMessageContent;

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
