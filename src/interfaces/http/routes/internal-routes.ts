import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";

import { ApplicationError } from "../../../application/errors/application-error";
import type { HttpRouteDependencies } from "./dependencies";

const mediaParamsSchema = z.object({
  tenantId: z.string().min(1),
  messageId: z.string().uuid()
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
