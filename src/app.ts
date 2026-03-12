import Fastify from "fastify";
import type { Logger } from "pino";

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

  registerErrorHandler(app);
  registerRoutes(app, dependencies);

  return app;
};
