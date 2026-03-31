import { ApplicationError } from "../../application/errors/application-error";
import type {
  ProviderConnectionRepository,
  ProviderMessageTemplateRecord,
  ProviderMessageTemplateRepository
} from "../../application/ports/repositories";
import {
  MetaCloudApiClient,
  type MetaProviderTemplate
} from "./meta-cloud-api-client";
import { parseMetaProviderConfig } from "./meta-provider-config";

export interface PublishMetaProviderTemplateInput {
  connectionId: string;
  name: string;
  languageCode: string;
  category: string;
  bodyText: string;
  exampleValues: string[];
}

export interface SyncMetaProviderTemplateStatusByNameInput {
  connectionId: string;
  name: string;
  languageCode: string;
}

export interface SyncMetaProviderTemplateStatusByIdInput {
  connectionId: string;
  externalTemplateId: string;
}

export interface MetaProviderTemplateResult {
  record: ProviderMessageTemplateRecord;
  rawProviderResponse: unknown;
}

const normalizeMetaTemplateStatus = (status: string): string => {
  switch (status.trim().toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    case "PAUSED":
    case "DISABLED":
      return "paused";
    case "IN_APPEAL":
    case "PENDING":
    case "PENDING_DELETION":
      return "in_review";
    default:
      return "publish_pending";
  }
};

export class MetaProviderTemplateManagementService {
  constructor(
    private readonly providerConnections: ProviderConnectionRepository,
    private readonly providerMessageTemplates: ProviderMessageTemplateRepository,
    private readonly client = new MetaCloudApiClient()
  ) {}

  async publishTemplate(input: PublishMetaProviderTemplateInput): Promise<MetaProviderTemplateResult> {
    const connection = await this.resolveConnection(input.connectionId);
    const config = parseMetaProviderConfig(connection.config);
    const whatsappBusinessAccountId = this.assertWhatsappBusinessAccountId(config.whatsappBusinessAccountId);
    const template = await this.client.createTemplate({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      baseUrl: config.baseUrl,
      whatsappBusinessAccountId,
      name: input.name,
      languageCode: input.languageCode,
      category: input.category,
      bodyText: input.bodyText,
      exampleValues: input.exampleValues
    });

    return {
      record: await this.persistTemplate(connection, template, null),
      rawProviderResponse: template.payloadRaw
    };
  }

  async syncTemplateStatusById(
    input: SyncMetaProviderTemplateStatusByIdInput
  ): Promise<MetaProviderTemplateResult> {
    const connection = await this.resolveConnection(input.connectionId);
    const config = parseMetaProviderConfig(connection.config);
    const template = await this.client.getTemplateById({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      baseUrl: config.baseUrl,
      externalTemplateId: input.externalTemplateId
    });

    return {
      record: await this.persistTemplate(connection, template, null),
      rawProviderResponse: template.payloadRaw
    };
  }

  async syncTemplateStatusByName(
    input: SyncMetaProviderTemplateStatusByNameInput
  ): Promise<MetaProviderTemplateResult> {
    const connection = await this.resolveConnection(input.connectionId);
    const config = parseMetaProviderConfig(connection.config);
    const whatsappBusinessAccountId = this.assertWhatsappBusinessAccountId(config.whatsappBusinessAccountId);
    const [template] = await this.client.findTemplatesByName({
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      baseUrl: config.baseUrl,
      whatsappBusinessAccountId,
      name: input.name,
      languageCode: input.languageCode
    });

    if (!template) {
      throw new ApplicationError("Meta provider template was not found", {
        code: "provider_template_not_found",
        statusCode: 404
      });
    }

    return {
      record: await this.persistTemplate(connection, template, null),
      rawProviderResponse: template.payloadRaw
    };
  }

  private async resolveConnection(connectionId: string) {
    const connection = await this.providerConnections.findById(connectionId);

    if (!connection || connection.provider !== "meta") {
      throw new ApplicationError("Meta provider connection was not found", {
        code: "provider_connection_not_found",
        statusCode: 404
      });
    }

    return connection;
  }

  private assertWhatsappBusinessAccountId(value: string | undefined) {
    if (!value) {
      throw new ApplicationError("Meta provider connection is missing whatsappBusinessAccountId", {
        code: "provider_connection_invalid",
        statusCode: 500
      });
    }

    return value;
  }

  private async persistTemplate(
    connection: Awaited<ReturnType<typeof this.resolveConnection>>,
    template: MetaProviderTemplate,
    lastError: string | null
  ) {
    return this.providerMessageTemplates.upsert({
      tenantId: connection.tenantId,
      providerConnectionId: connection.id,
      provider: "meta",
      externalTemplateId: template.id,
      providerTemplateName: template.name,
      languageCode: template.languageCode,
      category: template.category,
      status: normalizeMetaTemplateStatus(template.status),
      lastError,
      payloadRaw: template.payloadRaw
    });
  }
}
