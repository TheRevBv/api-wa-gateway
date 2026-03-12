export type BaileysSessionStatus =
  | "disabled"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "disconnected"
  | "error";

export interface BaileysSessionSnapshot {
  connectionId: string;
  tenantId: string;
  connectionKey: string;
  displayName: string;
  status: BaileysSessionStatus;
  qrCode: string | null;
  lastError: string | null;
  updatedAt: Date;
}

export interface BaileysSessionViewService {
  isEnabled(): boolean;
  listSessions(filters?: {
    tenantId?: string;
    connectionKey?: string;
  }): Promise<BaileysSessionSnapshot[]>;
}
