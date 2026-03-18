import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";

import type { HttpRouteDependencies } from "./dependencies";

const paramsSchema = z.object({
  connectionKey: z.string().min(1)
});

const verificationQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional()
});

const parseSignatureHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const registerMetaWebhookRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies
): void => {
  app.get("/webhooks/meta/:connectionKey", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const query = verificationQuerySchema.parse(request.query);
    const challenge = await dependencies.metaWebhookService.verifyWebhook({
      connectionKey: params.connectionKey,
      mode: query["hub.mode"],
      verifyToken: query["hub.verify_token"],
      challenge: query["hub.challenge"]
    });

    return reply.type("text/plain").send(challenge);
  });

  app.post("/webhooks/meta/:connectionKey", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const result = await dependencies.metaWebhookService.handleWebhookEvent({
      connectionKey: params.connectionKey,
      rawBody: request.rawBody ?? "",
      signatureHeader: parseSignatureHeader(request.headers["x-hub-signature-256"]),
      payload: request.body
    });

    return reply.status(200).send({
      received: true,
      processedMessages: result.processedMessages,
      processedStatuses: result.processedStatuses,
      ignoredEvents: result.ignoredEvents
    });
  });
};
