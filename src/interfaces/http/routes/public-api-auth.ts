import type { FastifyReply, FastifyRequest } from "fastify";

import type { HttpRouteDependencies } from "./dependencies";

function extractBearerToken(
  authorizationHeader: string | string[] | undefined,
) {
  const value = Array.isArray(authorizationHeader)
    ? (authorizationHeader[0] ?? "")
    : (authorizationHeader ?? "");
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());

  return match?.[1]?.trim() ?? null;
}

export async function requirePublicApiBearerToken(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: HttpRouteDependencies,
) {
  const expectedToken = dependencies.gatewayPublicApiBearerToken.trim();

  if (!expectedToken) {
    return;
  }

  const token = extractBearerToken(request.headers.authorization);

  if (token === expectedToken) {
    return;
  }

  return reply.status(401).send({
    error: {
      code: "invalid_public_api_token",
      message: "Public API bearer token is invalid",
    },
  });
}
