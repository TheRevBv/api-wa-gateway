export interface Contact {
  id: string;
  tenantId: string;
  phone: string;
  displayName: string | null;
  providerContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
