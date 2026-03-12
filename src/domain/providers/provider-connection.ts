export type ProviderName = "baileys" | "meta";
export type ProviderConnectionStatus = "active" | "inactive";

export interface ProviderConnection {
  id: string;
  tenantId: string;
  provider: ProviderName;
  connectionKey: string;
  displayName: string;
  status: ProviderConnectionStatus;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
