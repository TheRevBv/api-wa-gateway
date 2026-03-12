export type TenantStatus = "active" | "inactive";

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}
