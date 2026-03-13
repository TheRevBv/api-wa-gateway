import { ApplicationError } from "../../application/errors/application-error";
import type {
  ProviderSendMessageCommand,
  ProviderSendMessageResult,
  WhatsAppProvider
} from "../../application/ports/whatsapp-provider";
import { MetaCloudApiClient } from "./meta-cloud-api-client";
import { parseMetaProviderConfig } from "./meta-provider-config";

const toMetaPayload = (command: ProviderSendMessageCommand): Record<string, unknown> => {
  switch (command.content.type) {
    case "text":
      return {
        type: "text",
        text: {
          body: command.content.text
        }
      };
    case "image":
      if (!command.content.mediaUrl) {
        throw new ApplicationError("Image messages require a media URL", {
          code: "provider_send_failed",
          statusCode: 400
        });
      }

      return {
        type: "image",
        image: {
          link: command.content.mediaUrl,
          ...(command.content.caption ? { caption: command.content.caption } : {})
        }
      };
    case "document":
      if (!command.content.mediaUrl) {
        throw new ApplicationError("Document messages require a media URL", {
          code: "provider_send_failed",
          statusCode: 400
        });
      }

      return {
        type: "document",
        document: {
          link: command.content.mediaUrl,
          ...(command.content.caption ? { caption: command.content.caption } : {}),
          ...(command.content.fileName ? { filename: command.content.fileName } : {})
        }
      };
  }
};

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = "meta" as const;

  constructor(private readonly client = new MetaCloudApiClient()) {}

  async sendMessage(command: ProviderSendMessageCommand): Promise<ProviderSendMessageResult> {
    const config = parseMetaProviderConfig(command.connection.config);
    const response = await this.client.sendMessage({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      baseUrl: config.baseUrl,
      phoneNumberId: command.connection.connectionKey,
      to: command.to,
      payload: toMetaPayload(command)
    });

    return {
      providerMessageId: response.messageId,
      payloadRaw: response.payloadRaw,
      status: "sent",
      sentAt: new Date()
    };
  }
}
