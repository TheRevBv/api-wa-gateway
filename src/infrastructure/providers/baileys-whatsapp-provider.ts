import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { Logger } from "pino";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";

import { ApplicationError } from "../../application/errors/application-error";
import type {
  BaileysSessionSnapshot,
  BaileysSessionStatus,
  BaileysSessionViewService
} from "../../application/ports/baileys-session-view";
import type { ProviderConnectionRepository } from "../../application/ports/repositories";
import type {
  ProviderRuntime,
  ProviderSendMessageCommand,
  ProviderSendMessageResult,
  WhatsAppProvider
} from "../../application/ports/whatsapp-provider";
import { ReceiveInboundMessageUseCase } from "../../application/use-cases/receive-inbound-message";
import type { ProviderConnection } from "../../domain/providers/provider-connection";

type BaileysModule = typeof import("@whiskeysockets/baileys");

const VERIFIED_BAILEYS_VERSION: [number, number, number] = [2, 3000, 1033846690];
const INITIAL_RECONNECT_DELAY_MS = 2_000;
const STARTUP_RECONNECT_DELAY_MS = 5_000;
const RESET_AUTH_RECONNECT_DELAY_MS = 250;
const SEND_RETRY_CONNECTION_TIMEOUT_MS = 8_000;
const RETRYABLE_SEND_ERROR_CODES = new Set([408, 428, 503]);

interface SessionState {
  connection: ProviderConnection;
  status: BaileysSessionStatus;
  qrCode: string | null;
  lastError: string | null;
  updatedAt: Date;
}

const dynamicImport = new Function(
  "modulePath",
  "return import(modulePath);"
) as (modulePath: string) => Promise<BaileysModule>;

const extractErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as {
      message?: unknown;
      output?: {
        payload?: {
          message?: unknown;
        };
        statusCode?: unknown;
      };
      data?: unknown;
    };

    if (typeof value.output?.payload?.message === "string" && value.output.payload.message.length > 0) {
      return value.output.payload.message;
    }

    if (typeof value.message === "string" && value.message.length > 0) {
      return value.message;
    }
  }

  return String(error);
};

const extractDisconnectStatusCode = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = error as {
    output?: {
      statusCode?: unknown;
    };
    data?: {
      statusCode?: unknown;
    };
  };

  if (typeof value.output?.statusCode === "number") {
    return value.output.statusCode;
  }

  if (typeof value.data?.statusCode === "number") {
    return value.data.statusCode;
  }

  return null;
};

const describeDisconnectReason = (statusCode: number | null): string | null => {
  switch (statusCode) {
    case 401:
      return "Sesion cerrada. Se requiere un nuevo QR.";
    case 403:
      return "WhatsApp rechazo la conexion.";
    case 408:
      return "La conexion con WhatsApp expiro o se perdio.";
    case 411:
      return "La cuenta no tiene multi-dispositivo habilitado.";
    case 428:
      return "La conexion fue cerrada antes de completarse.";
    case 440:
      return "La sesion fue reemplazada por otra conexion.";
    case 500:
      return "La sesion guardada es invalida.";
    case 503:
      return "WhatsApp no estuvo disponible temporalmente.";
    case 515:
      return "WhatsApp pidio reiniciar la sesion.";
    default:
      return null;
  }
};

const mergeErrorDetails = (reason: string | null, message: string | null): string | null => {
  if (reason && message && reason !== message) {
    return `${reason} ${message}`;
  }

  return reason ?? message;
};

const isRetryableSendError = (error: unknown): boolean => {
  const statusCode = extractDisconnectStatusCode(error);

  return statusCode !== null && RETRYABLE_SEND_ERROR_CODES.has(statusCode);
};

const normalizePhone = (value: string): string => value.replace(/[^\d]/g, "");

const toWhatsAppJid = (phone: string): string => `${normalizePhone(phone)}@s.whatsapp.net`;

const fromWhatsAppJid = (jid: string): string => jid.split("@")[0] ?? jid;

const extractTimestamp = (message: WAMessage): Date => {
  const rawTimestamp = message.messageTimestamp;

  if (typeof rawTimestamp === "number") {
    return new Date(rawTimestamp * 1000);
  }

  if (typeof rawTimestamp === "bigint") {
    return new Date(Number(rawTimestamp) * 1000);
  }

  if (typeof rawTimestamp === "object" && rawTimestamp !== null && "low" in rawTimestamp) {
    return new Date(Number(rawTimestamp.low) * 1000);
  }

  return new Date();
};

const normalizeInboundContent = (message: WAMessage) => {
  const payload = message.message;

  if (!payload) {
    return null;
  }

  if (typeof payload.conversation === "string" && payload.conversation.length > 0) {
    return {
      type: "text" as const,
      text: payload.conversation
    };
  }

  const extendedText = payload.extendedTextMessage?.text;

  if (typeof extendedText === "string" && extendedText.length > 0) {
    return {
      type: "text" as const,
      text: extendedText
    };
  }

  const imageMessage = payload.imageMessage;

  if (imageMessage) {
    return {
      type: "image" as const,
      mediaUrl:
        (typeof imageMessage.url === "string" && imageMessage.url.length > 0
          ? imageMessage.url
          : `baileys://message/${message.key.id ?? "unknown"}`),
      mimeType: imageMessage.mimetype ?? undefined,
      caption: imageMessage.caption ?? undefined,
      fileName: imageMessage.fileSha256 ? `image-${message.key.id ?? "unknown"}` : undefined
    };
  }

  const documentMessage = payload.documentMessage;

  if (documentMessage) {
    return {
      type: "document" as const,
      mediaUrl:
        (typeof documentMessage.url === "string" && documentMessage.url.length > 0
          ? documentMessage.url
          : `baileys://message/${message.key.id ?? "unknown"}`),
      mimeType: documentMessage.mimetype ?? undefined,
      caption: documentMessage.caption ?? undefined,
      fileName: documentMessage.fileName ?? `document-${message.key.id ?? "unknown"}`
    };
  }

  return null;
};

const toBaileysMessageContent = (content: ProviderSendMessageCommand["content"]) => {
  if (content.type === "text") {
    return { text: content.text };
  }

  if (content.type === "image") {
    return {
      image: { url: content.mediaUrl },
      caption: content.caption,
      mimetype: content.mimeType,
      fileName: content.fileName
    };
  }

  return {
    document: { url: content.mediaUrl },
    caption: content.caption,
    mimetype: content.mimeType ?? "application/octet-stream",
    fileName: content.fileName
  };
};

export interface BaileysWhatsAppProviderOptions {
  enabled: boolean;
  authDir: string;
}

export class BaileysWhatsAppProvider
  implements WhatsAppProvider, ProviderRuntime, BaileysSessionViewService
{
  readonly providerName = "baileys" as const;

  private readonly sockets = new Map<string, WASocket>();
  private readonly pendingSockets = new Map<string, Promise<WASocket>>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly sessionStates = new Map<string, SessionState>();
  private stopped = false;

  isEnabled(): boolean {
    return this.options.enabled;
  }

  constructor(
    private readonly connectionRepository: ProviderConnectionRepository,
    private readonly receiveInboundMessageUseCase: ReceiveInboundMessageUseCase,
    private readonly options: BaileysWhatsAppProviderOptions,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.info("Baileys runtime disabled by configuration");
      return;
    }

    this.stopped = false;
    const connections = await this.connectionRepository.listActiveByProvider("baileys");
    connections.forEach((connection) => this.upsertSessionState(connection, "connecting"));
    await Promise.all(connections.map((connection) => this.bootstrapConnection(connection)));
  }

  async stop(): Promise<void> {
    this.stopped = true;

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }

    this.reconnectTimers.clear();

    for (const socket of this.sockets.values()) {
      const socketWithClose = socket as unknown as { end?: () => void; ws?: { close?: () => void } };
      socketWithClose.end?.();
      socketWithClose.ws?.close?.();
    }

    this.sockets.clear();
    this.pendingSockets.clear();
  }

  async listSessions(filters?: { tenantId?: string; connectionKey?: string }): Promise<BaileysSessionSnapshot[]> {
    const connections = await this.connectionRepository.listActiveByProvider("baileys");

    connections.forEach((connection) => {
      if (!this.sessionStates.has(connection.id)) {
        this.upsertSessionState(connection, this.options.enabled ? "connecting" : "disabled");
      }
    });

    return connections
      .map((connection) => this.sessionStates.get(connection.id))
      .filter((state): state is SessionState => Boolean(state))
      .filter((state) => {
        if (filters?.tenantId && state.connection.tenantId !== filters.tenantId) {
          return false;
        }

        if (filters?.connectionKey && state.connection.connectionKey !== filters.connectionKey) {
          return false;
        }

        return true;
      })
      .map((state) => ({
        connectionId: state.connection.id,
        tenantId: state.connection.tenantId,
        connectionKey: state.connection.connectionKey,
        displayName: state.connection.displayName,
        status: state.status,
        qrCode: state.qrCode,
        lastError: state.lastError,
        updatedAt: state.updatedAt
      }));
  }

  async sendMessage(command: ProviderSendMessageCommand): Promise<ProviderSendMessageResult> {
    if (!this.options.enabled) {
      throw new ApplicationError("Baileys provider is disabled", {
        code: "provider_disabled",
        statusCode: 503
      });
    }

    try {
      return await this.attemptSendMessage(command);
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }

      this.logger.error(
        {
          error,
          tenantId: command.connection.tenantId,
          connectionKey: command.connection.connectionKey
        },
        "Failed to send outbound message through Baileys"
      );

      return {
        providerMessageId: null,
        payloadRaw: {
          error: error instanceof Error ? error.message : "Unknown Baileys send error"
        },
        status: "failed",
        sentAt: null
      };
    }
  }

  private async attemptSendMessage(
    command: ProviderSendMessageCommand,
    attempt = 1
  ): Promise<ProviderSendMessageResult> {
    const socket = await this.waitForReadySocket(command.connection);

    try {
      const response = await socket.sendMessage(
        toWhatsAppJid(command.to),
        toBaileysMessageContent(command.content)
      );

      return {
        providerMessageId: response?.key.id ?? null,
        payloadRaw: response ?? null,
        status: "sent",
        sentAt: new Date()
      };
    } catch (error) {
      if (attempt === 1 && isRetryableSendError(error)) {
        this.logger.warn(
          {
            error,
            tenantId: command.connection.tenantId,
            connectionKey: command.connection.connectionKey
          },
          "Retrying outbound Baileys send after transient connection error"
        );

        this.sockets.delete(command.connection.id);
        this.scheduleReconnect(command.connection, INITIAL_RECONNECT_DELAY_MS);
        await this.waitForReadySocket(command.connection, SEND_RETRY_CONNECTION_TIMEOUT_MS);

        return this.attemptSendMessage(command, attempt + 1);
      }

      return {
        providerMessageId: null,
        payloadRaw: {
          error: extractErrorMessage(error) ?? "Unknown Baileys send error",
          statusCode: extractDisconnectStatusCode(error)
        },
        status: "failed",
        sentAt: null
      };
    }
  }

  private async bootstrapConnection(connection: ProviderConnection): Promise<void> {
    try {
      await this.ensureSocket(connection);
    } catch (error) {
      this.markSessionAsErrored(connection, "No se pudo iniciar la sesion Baileys.", error);
      this.logger.error(
        {
          error,
          tenantId: connection.tenantId,
          connectionKey: connection.connectionKey
        },
        "Failed to bootstrap Baileys session"
      );
      this.scheduleReconnect(connection, STARTUP_RECONNECT_DELAY_MS);
    }
  }

  private async ensureSocket(connection: ProviderConnection): Promise<WASocket> {
    const existingSocket = this.sockets.get(connection.id);

    if (existingSocket) {
      return existingSocket;
    }

    const pendingSocket = this.pendingSockets.get(connection.id);

    if (pendingSocket) {
      return pendingSocket;
    }

    this.upsertSessionState(connection, "connecting");
    const socketPromise = this.createSocket(connection);
    this.pendingSockets.set(connection.id, socketPromise);

    try {
      const socket = await socketPromise;
      this.sockets.set(connection.id, socket);
      return socket;
    } finally {
      this.pendingSockets.delete(connection.id);
    }
  }

  private async createSocket(connection: ProviderConnection): Promise<WASocket> {
    const authPath = path.join(this.options.authDir, connection.connectionKey);
    await mkdir(authPath, { recursive: true });

    const baileys = await dynamicImport("@whiskeysockets/baileys");
    const makeWASocket =
      typeof baileys.makeWASocket === "function"
        ? baileys.makeWASocket
        : typeof baileys.default === "function"
          ? baileys.default
          : null;
    const {
      Browsers,
      DisconnectReason,
      fetchLatestBaileysVersion,
      useMultiFileAuthState
    } = baileys;

    if (!makeWASocket) {
      throw new Error("Baileys socket factory is not available");
    }

    const authState = await useMultiFileAuthState(authPath);
    const version = await this.resolveSocketVersion(connection, fetchLatestBaileysVersion);

    const socket = makeWASocket({
      auth: authState.state,
      version,
      browser: Browsers.ubuntu("api-wa-gateway"),
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });

    socket.ev.on("creds.update", authState.saveCreds);
    socket.ev.on("connection.update", (update) => {
      if (update.connection === "connecting") {
        this.updateSessionState(connection.id, {
          status: "connecting",
          lastError: null
        });
      }

      if (update.qr) {
        this.clearReconnectTimer(connection.id);
        this.updateSessionState(connection.id, {
          status: "qr_ready",
          qrCode: update.qr,
          lastError: null
        });
        this.logger.info(
          {
            connectionKey: connection.connectionKey,
            tenantId: connection.tenantId,
            qr: update.qr
          },
          "Baileys QR received"
        );
      }

      if (update.connection === "open") {
        this.clearReconnectTimer(connection.id);
        this.updateSessionState(connection.id, {
          status: "connected",
          qrCode: null,
          lastError: null
        });
        this.logger.info(
          {
            connectionKey: connection.connectionKey,
            tenantId: connection.tenantId
          },
          "Baileys connection opened"
        );
      }

      if (update.connection === "close") {
        const statusCode = extractDisconnectStatusCode(update.lastDisconnect?.error);
        const lastError = mergeErrorDetails(
          describeDisconnectReason(statusCode),
          extractErrorMessage(update.lastDisconnect?.error)
        );
        const shouldResetAuth =
          statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession;
        const shouldReconnect =
          !this.stopped &&
          !shouldResetAuth &&
          statusCode !== DisconnectReason.connectionReplaced;

        this.updateSessionState(connection.id, {
          status: lastError ? "error" : "disconnected",
          qrCode: null,
          lastError
        });
        this.logger.warn(
          {
            connectionKey: connection.connectionKey,
            tenantId: connection.tenantId,
            statusCode,
            shouldReconnect,
            shouldResetAuth,
            lastError
          },
          "Baileys connection closed"
        );
        this.sockets.delete(connection.id);

        if (shouldResetAuth) {
          void this.resetAuthState(connection, lastError);
          return;
        }

        if (shouldReconnect) {
          this.scheduleReconnect(connection);
        }
      }
    });

    socket.ev.on("messages.upsert", async (event) => {
      if (event.type !== "notify") {
        return;
      }

      for (const message of event.messages) {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid || message.key.fromMe || remoteJid.endsWith("@g.us")) {
          continue;
        }

        const content = normalizeInboundContent(message);

        if (!content || !message.key.id) {
          continue;
        }

        try {
          await this.receiveInboundMessageUseCase.execute({
            tenantId: connection.tenantId,
            provider: "baileys",
            providerMessageId: message.key.id,
            providerContactId: remoteJid,
            from: fromWhatsAppJid(remoteJid),
            displayName: message.pushName ?? null,
            content,
            payloadRaw: message,
            receivedAt: extractTimestamp(message)
          });
        } catch (error) {
          this.logger.error(
            {
              error,
              tenantId: connection.tenantId,
              connectionKey: connection.connectionKey,
              providerMessageId: message.key.id
            },
            "Failed to process inbound Baileys message"
          );
        }
      }
    });

    return socket;
  }

  private async waitForReadySocket(
    connection: ProviderConnection,
    timeoutMs = SEND_RETRY_CONNECTION_TIMEOUT_MS
  ): Promise<WASocket> {
    const socket = await this.ensureSocket(connection);
    const currentState = this.sessionStates.get(connection.id);

    if (currentState?.status === "connected") {
      return socket;
    }

    if (currentState?.status === "qr_ready") {
      throw new ApplicationError("Baileys session requires QR scan", {
        code: "provider_auth_required",
        statusCode: 409
      });
    }

    try {
      await socket.waitForConnectionUpdate(async () => {
        const status = this.sessionStates.get(connection.id)?.status;
        return status === "connected" || status === "qr_ready";
      }, timeoutMs);
    } catch (error) {
      this.logger.warn(
        {
          error,
          tenantId: connection.tenantId,
          connectionKey: connection.connectionKey
        },
        "Timed out waiting for Baileys session readiness"
      );
    }

    const nextState = this.sessionStates.get(connection.id);

    if (nextState?.status === "connected") {
      return this.sockets.get(connection.id) ?? socket;
    }

    if (nextState?.status === "qr_ready") {
      throw new ApplicationError("Baileys session requires QR scan", {
        code: "provider_auth_required",
        statusCode: 409
      });
    }

    throw new ApplicationError("Baileys session is not ready to send messages", {
      code: "provider_unavailable",
      statusCode: 503
    });
  }

  private async resolveSocketVersion(
    connection: ProviderConnection,
    fetchLatestBaileysVersion: BaileysModule["fetchLatestBaileysVersion"]
  ): Promise<[number, number, number]> {
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      return versionInfo.version as [number, number, number];
    } catch (error) {
      this.logger.warn(
        {
          error,
          tenantId: connection.tenantId,
          connectionKey: connection.connectionKey,
          fallbackVersion: VERIFIED_BAILEYS_VERSION.join(".")
        },
        "Failed to resolve latest Baileys web version; using verified fallback"
      );

      return VERIFIED_BAILEYS_VERSION;
    }
  }

  private scheduleReconnect(connection: ProviderConnection, delayMs = INITIAL_RECONNECT_DELAY_MS): void {
    if (this.stopped || !this.options.enabled || this.reconnectTimers.has(connection.id)) {
      return;
    }

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(connection.id);

      void this.ensureSocket(connection).catch((error) => {
        this.markSessionAsErrored(connection, "No se pudo reconectar la sesion Baileys.", error);
        this.logger.error(
          {
            error,
            tenantId: connection.tenantId,
            connectionKey: connection.connectionKey
          },
          "Failed to reconnect Baileys session"
        );
        this.scheduleReconnect(connection, STARTUP_RECONNECT_DELAY_MS);
      });
    }, delayMs);

    timer.unref?.();
    this.reconnectTimers.set(connection.id, timer);
  }

  private async resetAuthState(connection: ProviderConnection, reason: string | null): Promise<void> {
    this.clearReconnectTimer(connection.id);

    try {
      await rm(path.join(this.options.authDir, connection.connectionKey), {
        recursive: true,
        force: true
      });
      this.logger.info(
        {
          tenantId: connection.tenantId,
          connectionKey: connection.connectionKey
        },
        "Cleared Baileys auth state to request a fresh QR"
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          tenantId: connection.tenantId,
          connectionKey: connection.connectionKey
        },
        "Failed to clear Baileys auth state"
      );
    }

    this.updateSessionState(connection.id, {
      status: "connecting",
      qrCode: null,
      lastError: reason
    });
    this.scheduleReconnect(connection, RESET_AUTH_RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(connectionId: string): void {
    const timer = this.reconnectTimers.get(connectionId);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.reconnectTimers.delete(connectionId);
  }

  private markSessionAsErrored(connection: ProviderConnection, prefix: string, error: unknown): void {
    this.updateSessionState(connection.id, {
      status: "error",
      lastError: mergeErrorDetails(prefix, extractErrorMessage(error))
    });
  }

  private upsertSessionState(connection: ProviderConnection, status: BaileysSessionStatus): void {
    const existing = this.sessionStates.get(connection.id);

    this.sessionStates.set(connection.id, {
      connection,
      status,
      qrCode: existing?.qrCode ?? null,
      lastError: existing?.lastError ?? null,
      updatedAt: new Date()
    });
  }

  private updateSessionState(
    connectionId: string,
    input: {
      status?: BaileysSessionStatus;
      qrCode?: string | null;
      lastError?: string | null;
    }
  ): void {
    const existing = this.sessionStates.get(connectionId);

    if (!existing) {
      return;
    }

    this.sessionStates.set(connectionId, {
      ...existing,
      status: input.status ?? existing.status,
      qrCode: input.qrCode !== undefined ? input.qrCode : existing.qrCode,
      lastError: input.lastError !== undefined ? input.lastError : existing.lastError,
      updatedAt: new Date()
    });
  }
}
