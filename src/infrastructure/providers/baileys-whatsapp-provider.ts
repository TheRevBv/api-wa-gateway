import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { Logger } from "pino";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";

import { ApplicationError } from "../../application/errors/application-error";
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

interface SocketHandle {
  socket: WASocket;
  connection: ProviderConnection;
}

const dynamicImport = new Function(
  "modulePath",
  "return import(modulePath);"
) as (modulePath: string) => Promise<BaileysModule>;

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

export class BaileysWhatsAppProvider implements WhatsAppProvider, ProviderRuntime {
  readonly providerName = "baileys" as const;

  private readonly sockets = new Map<string, SocketHandle>();
  private readonly pendingSockets = new Map<string, Promise<SocketHandle>>();

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

    const connections = await this.connectionRepository.listActiveByProvider("baileys");
    await Promise.all(connections.map((connection) => this.ensureSocket(connection)));
  }

  async stop(): Promise<void> {
    for (const handle of this.sockets.values()) {
      const socketWithClose = handle.socket as unknown as { end?: () => void; ws?: { close?: () => void } };
      socketWithClose.end?.();
      socketWithClose.ws?.close?.();
    }

    this.sockets.clear();
    this.pendingSockets.clear();
  }

  async sendMessage(command: ProviderSendMessageCommand): Promise<ProviderSendMessageResult> {
    if (!this.options.enabled) {
      throw new ApplicationError("Baileys provider is disabled", {
        code: "provider_disabled",
        statusCode: 503
      });
    }

    const handle = await this.ensureSocket(command.connection);

    try {
      const response = await handle.socket.sendMessage(
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

  private async ensureSocket(connection: ProviderConnection): Promise<SocketHandle> {
    const existingSocket = this.sockets.get(connection.id);

    if (existingSocket) {
      return existingSocket;
    }

    const pendingSocket = this.pendingSockets.get(connection.id);

    if (pendingSocket) {
      return pendingSocket;
    }

    const socketPromise = this.createSocket(connection);
    this.pendingSockets.set(connection.id, socketPromise);

    try {
      const handle = await socketPromise;
      this.sockets.set(connection.id, handle);
      return handle;
    } finally {
      this.pendingSockets.delete(connection.id);
    }
  }

  private async createSocket(connection: ProviderConnection): Promise<SocketHandle> {
    await mkdir(path.join(this.options.authDir, connection.connectionKey), { recursive: true });

    const baileys = await dynamicImport("@whiskeysockets/baileys");
    const { default: makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState } = baileys;
    const authState = await useMultiFileAuthState(path.join(this.options.authDir, connection.connectionKey));
    const versionInfo = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      auth: authState.state,
      version: versionInfo.version
    });

    socket.ev.on("creds.update", authState.saveCreds);
    socket.ev.on("connection.update", (update) => {
      if (update.qr) {
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
        this.logger.info(
          {
            connectionKey: connection.connectionKey,
            tenantId: connection.tenantId
          },
          "Baileys connection opened"
        );
      }

      if (update.connection === "close") {
        this.logger.warn(
          {
            connectionKey: connection.connectionKey,
            tenantId: connection.tenantId
          },
          "Baileys connection closed"
        );
        this.sockets.delete(connection.id);
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

    return {
      socket,
      connection
    };
  }
}
