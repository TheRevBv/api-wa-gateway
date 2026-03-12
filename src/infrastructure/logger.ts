import pino, { type Logger } from "pino";

export const createLogger = (level: string): Logger =>
  pino({
    level,
    transport:
      process.env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "SYS:standard",
              colorize: true
            }
          }
        : undefined
  });
