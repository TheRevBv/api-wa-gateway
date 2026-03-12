import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";

import type { HttpRouteDependencies } from "./routes/dependencies";
import { registerBaileysAuthRoutes } from "./routes/baileys-auth-routes";
import { registerConversationRoutes } from "./routes/conversation-routes";
import { registerHealthRoutes } from "./routes/health-routes";
import { registerMessageRoutes } from "./routes/message-routes";

export const registerRoutes = (
  app: FastifyInstance<any, any, any, Logger>,
  dependencies: HttpRouteDependencies
): void => {
  registerHealthRoutes(app);
  registerBaileysAuthRoutes(app, dependencies);
  registerMessageRoutes(app, dependencies);
  registerConversationRoutes(app, dependencies);
};
