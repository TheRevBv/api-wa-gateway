import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";

import type { HttpRouteDependencies } from "./dependencies";
import { toContactResponse, toConversationResponse, toMessageResponse } from "../presenters";

const sendMessageBodySchema = z.object({
  to: z.string().min(8),
  content: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      text: z.string().min(1),
      previewUrl: z.boolean().optional()
    }),
    z.object({
      type: z.literal("image"),
      mediaUrl: z.url(),
      mimeType: z.string().optional(),
      caption: z.string().optional(),
      fileName: z.string().optional()
    }),
    z.object({
      type: z.literal("document"),
      mediaUrl: z.url(),
      mimeType: z.string().optional(),
      caption: z.string().optional(),
      fileName: z.string().min(1)
    }),
    z.object({
      type: z.literal("template"),
      name: z.string().min(1),
      languageCode: z.string().min(1).optional()
    })
  ])
});

const tenantParamsSchema = z.object({
  tenantId: z.string().min(1)
});

export const registerMessageRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies
): void => {
  app.post("/api/v1/tenants/:tenantId/messages", async (request, reply) => {
    const params = tenantParamsSchema.parse(request.params);
    const body = sendMessageBodySchema.parse(request.body);

    const result = await dependencies.sendOutboundMessage.execute({
      tenantId: params.tenantId,
      to: body.to,
      content: body.content
    });

    return reply.status(201).send({
      contact: toContactResponse(result.contact),
      conversation: toConversationResponse(result.conversation),
      message: toMessageResponse(result.message)
    });
  });
};
