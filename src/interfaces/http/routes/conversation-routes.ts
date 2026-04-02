import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { z } from "zod";

import type { HttpRouteDependencies } from "./dependencies";
import { requirePublicApiBearerToken } from "./public-api-auth";
import {
  toContactResponse,
  toConversationResponse,
  toMessageResponse,
} from "../presenters";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const tenantParamsSchema = z.object({
  tenantId: z.string().min(1),
});

const conversationParamsSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
});

export const registerConversationRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies,
): void => {
  app.get(
    "/api/v1/tenants/:tenantId/conversations",
    {
      preHandler: async (request, reply) =>
        requirePublicApiBearerToken(request, reply, dependencies),
    },
    async (request) => {
      const params = tenantParamsSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);

      const result = await dependencies.listConversations.execute(
        params.tenantId,
        query,
      );

      return {
        items: result.items.map((item) => ({
          conversation: toConversationResponse(item.conversation),
          contact: toContactResponse(item.contact),
        })),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      };
    },
  );

  app.get(
    "/api/v1/tenants/:tenantId/conversations/:conversationId",
    {
      preHandler: async (request, reply) =>
        requirePublicApiBearerToken(request, reply, dependencies),
    },
    async (request) => {
      const params = conversationParamsSchema.parse(request.params);
      const result = await dependencies.getConversation.execute(
        params.tenantId,
        params.conversationId,
      );

      return {
        conversation: toConversationResponse(result.conversation),
        contact: toContactResponse(result.contact),
      };
    },
  );

  app.get(
    "/api/v1/tenants/:tenantId/conversations/:conversationId/messages",
    {
      preHandler: async (request, reply) =>
        requirePublicApiBearerToken(request, reply, dependencies),
    },
    async (request) => {
      const params = conversationParamsSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);
      const result = await dependencies.listConversationMessages.execute(
        params.tenantId,
        params.conversationId,
        query,
      );

      return {
        items: result.items.map(toMessageResponse),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      };
    },
  );
};
