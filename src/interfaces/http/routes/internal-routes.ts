import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";

import { ApplicationError } from "../../../application/errors/application-error";
import type { HttpRouteDependencies } from "./dependencies";

const mediaParamsSchema = z.object({
  tenantId: z.string().min(1),
  messageId: z.string().uuid()
});

const providerTemplateConnectionParamsSchema = z.object({
  connectionId: z.string().min(1)
});

const providerTemplateByIdParamsSchema = z.object({
  connectionId: z.string().min(1),
  externalTemplateId: z.string().min(1)
});

const providerTemplateByNameParamsSchema = z.object({
  connectionId: z.string().min(1),
  name: z.string().min(1)
});

const publishProviderTemplateBodySchema = z.object({
  name: z.string().min(1),
  languageCode: z.string().min(1),
  category: z.string().min(1),
  bodyText: z.string().min(1),
  exampleValues: z.array(z.string()).default([]),
  headerText: z.string().min(1).max(60).optional(),
  buttons: z
    .array(
      z.object({
        type: z.enum(["quick_reply", "url"]),
        text: z.string().min(1).max(25),
        url: z.string().url().optional()
      })
    )
    .max(10)
    .optional()
});

const syncProviderTemplateByNameQuerySchema = z.object({
  languageCode: z.string().min(1)
});

const assertGatewaySharedSecret = (
  providedSecret: string | string[] | undefined,
  expectedSecret: string
) => {
  const normalizedSecret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;

  if (!normalizedSecret || normalizedSecret !== expectedSecret) {
    throw new ApplicationError("Invalid internal gateway secret", {
      code: "invalid_internal_secret",
      statusCode: 401
    });
  }
};

export const registerInternalRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies
): void => {
  app.post("/api/internal/providers/meta/connections/:connectionId/templates", async (request) => {
    assertGatewaySharedSecret(
      request.headers["x-gateway-shared-secret"],
      dependencies.gatewaySharedSecret
    );

    const params = providerTemplateConnectionParamsSchema.parse(request.params);
    const body = publishProviderTemplateBodySchema.parse(request.body);
    const result = await dependencies.metaProviderTemplateManagement.publishTemplate({
      connectionId: params.connectionId,
      name: body.name,
      languageCode: body.languageCode,
      category: body.category,
      bodyText: body.bodyText,
      exampleValues: body.exampleValues,
      headerText: body.headerText,
      buttons: body.buttons
    });

    return {
      data: {
        ...result.record,
        rawProviderResponse: result.rawProviderResponse
      }
    };
  });

  app.get(
    "/api/internal/providers/meta/connections/:connectionId/templates/by-name/:name",
    async (request) => {
      assertGatewaySharedSecret(
        request.headers["x-gateway-shared-secret"],
        dependencies.gatewaySharedSecret
      );

      const params = providerTemplateByNameParamsSchema.parse(request.params);
      const query = syncProviderTemplateByNameQuerySchema.parse(request.query);
      const result = await dependencies.metaProviderTemplateManagement.syncTemplateStatusByName({
        connectionId: params.connectionId,
        name: params.name,
        languageCode: query.languageCode
      });

      return {
        data: {
          ...result.record,
          rawProviderResponse: result.rawProviderResponse
        }
      };
    }
  );

  app.get(
    "/api/internal/providers/meta/connections/:connectionId/templates/:externalTemplateId",
    async (request) => {
      assertGatewaySharedSecret(
        request.headers["x-gateway-shared-secret"],
        dependencies.gatewaySharedSecret
      );

      const params = providerTemplateByIdParamsSchema.parse(request.params);
      const result = await dependencies.metaProviderTemplateManagement.syncTemplateStatusById({
        connectionId: params.connectionId,
        externalTemplateId: params.externalTemplateId
      });

      return {
        data: {
          ...result.record,
          rawProviderResponse: result.rawProviderResponse
        }
      };
    }
  );

  app.get("/api/internal/tenants/:tenantId/messages/:messageId/media", async (request, reply) => {
    assertGatewaySharedSecret(
      request.headers["x-gateway-shared-secret"],
      dependencies.gatewaySharedSecret
    );

    const params = mediaParamsSchema.parse(request.params);
    const result = await dependencies.downloadMessageMedia.execute(
      params.tenantId,
      params.messageId
    );

    reply.header("content-type", result.contentType);

    if (result.contentLength !== null) {
      reply.header("content-length", String(result.contentLength));
    }

    reply.header(
      "content-disposition",
      `inline; filename="${result.fileName ?? `media-${params.messageId}`}"`,
    );

    return reply.send(Buffer.from(result.content));
  });
};
