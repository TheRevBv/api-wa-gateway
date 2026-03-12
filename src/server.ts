import "dotenv/config";

import { buildApp } from "./app";
import { loadEnvironment } from "./config/env";
import { createLogger } from "./infrastructure/logger";
import { createRuntimeContext } from "./infrastructure/runtime";

const start = async (): Promise<void> => {
  const env = loadEnvironment();
  const logger = createLogger(env.LOG_LEVEL);
  const runtime = createRuntimeContext(env, logger);
  const app = buildApp({
    logger,
    dependencies: runtime.services
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down server");
    await app.close();
    await runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({
    host: env.HOST,
    port: env.PORT
  });

  await Promise.all(runtime.providerRuntimes.map((providerRuntime) => providerRuntime.start()));
  logger.info({ host: env.HOST, port: env.PORT }, "api-wa-gateway listening");
};

void start();
