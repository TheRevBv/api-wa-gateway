import { ApplicationError } from "../../application/errors/application-error";
import type {
  ProviderSendMessageCommand,
  ProviderSendMessageResult,
  WhatsAppProvider
} from "../../application/ports/whatsapp-provider";
import { MetaCloudApiClient } from "./meta-cloud-api-client";
import { parseMetaProviderConfig } from "./meta-provider-config";

const toTemplateComponents = (bodyParameters?: Array<string | number>) => {
  if (!bodyParameters || bodyParameters.length === 0) {
    return undefined;
  }

  return [
    {
      type: "body",
      parameters: bodyParameters.map((parameter) => ({
        type: "text",
        text: String(parameter)
      }))
    }
  ];
};

const toMetaPayload = async (
  client: MetaCloudApiClient,
  command: ProviderSendMessageCommand,
): Promise<Record<string, unknown>> => {
  const config = parseMetaProviderConfig(command.connection.config);

  switch (command.content.type) {
    case "text":
      return {
        type: "text",
        text: {
          body: command.content.text,
          ...(command.content.previewUrl !== undefined ? { preview_url: command.content.previewUrl } : {})
        }
      };
    case "image":
      if (!command.content.mediaUrl) {
        throw new ApplicationError("Image messages require a media URL", {
          code: "provider_send_failed",
          statusCode: 400
        });
      }

      const uploadedImageId = await client.uploadMedia({
        accessToken: config.accessToken,
        apiVersion: config.apiVersion,
        baseUrl: config.baseUrl,
        phoneNumberId: command.connection.connectionKey,
        mediaUrl: command.content.mediaUrl,
        mimeType: command.content.mimeType,
        fileName: command.content.fileName
      });

      return {
        type: "image",
        image: {
          id: uploadedImageId,
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

      const uploadedDocumentId = await client.uploadMedia({
        accessToken: config.accessToken,
        apiVersion: config.apiVersion,
        baseUrl: config.baseUrl,
        phoneNumberId: command.connection.connectionKey,
        mediaUrl: command.content.mediaUrl,
        mimeType: command.content.mimeType,
        fileName: command.content.fileName
      });

      return {
        type: "document",
        document: {
          id: uploadedDocumentId,
          ...(command.content.caption ? { caption: command.content.caption } : {}),
          ...(command.content.fileName ? { filename: command.content.fileName } : {})
        }
      };
    case "template":
      return {
        type: "template",
        template: {
          name: command.content.name,
          language: {
            code: command.content.languageCode ?? "en_US"
          },
          ...(toTemplateComponents(command.content.bodyParameters)
            ? {
                components: toTemplateComponents(command.content.bodyParameters)
              }
            : {})
        }
      };
  }
};

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly providerName = "meta" as const;

  constructor(private readonly client = new MetaCloudApiClient()) {}

  async sendMessage(command: ProviderSendMessageCommand): Promise<ProviderSendMessageResult> {
    const config = parseMetaProviderConfig(command.connection.config);
    const payload = await toMetaPayload(this.client, command);
    const response = await this.client.sendMessage({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      baseUrl: config.baseUrl,
      phoneNumberId: command.connection.connectionKey,
      to: command.to,
      payload
    });

    return {
      providerMessageId: response.messageId,
      payloadRaw: response.payloadRaw,
      status: response.messageStatus ?? "sent",
      sentAt: new Date()
    };
  }
}
