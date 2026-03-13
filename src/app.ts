import Fastify from "fastify";
import type { Logger } from "pino";

import { ApplicationError } from "./application/errors/application-error";
import { registerErrorHandler } from "./interfaces/http/errors";
import { registerRoutes } from "./interfaces/http/register-routes";
import type { HttpRouteDependencies } from "./interfaces/http/routes/dependencies";

export interface BuildAppOptions {
  logger: Logger;
  dependencies: HttpRouteDependencies;
}

export const buildApp = ({ logger, dependencies }: BuildAppOptions) => {
  const app = Fastify({
    loggerInstance: logger
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    request.rawBody = rawBody;

    try {
      done(null, rawBody.length === 0 ? null : JSON.parse(rawBody));
    } catch {
      done(
        new ApplicationError("Request body is not valid JSON", {
          code: "invalid_json_body",
          statusCode: 400
        }),
        undefined
      );
    }
  });

  registerErrorHandler(app);
  registerRoutes(app, dependencies);

  return app;
};
