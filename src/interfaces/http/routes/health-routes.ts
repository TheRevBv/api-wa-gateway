import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";

export const registerHealthRoutes = (app: FastifyInstance<any, any, any, Logger>): void => {
  app.get("/health", async () => ({
    status: "ok"
  }));
};
