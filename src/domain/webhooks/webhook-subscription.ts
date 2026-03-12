export interface WebhookSubscription {
  id: string;
  tenantId: string;
  callbackUrl: string;
  secret: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
