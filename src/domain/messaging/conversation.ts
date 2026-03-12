export type ConversationChannel = "whatsapp";
export type ConversationStatus = "active" | "archived";

export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  startedAt: Date;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
