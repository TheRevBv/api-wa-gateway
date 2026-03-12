import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  WEBHOOK_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(3).default(1),
  ENABLE_BAILEYS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  BAILEYS_AUTH_DIR: z.string().default(".baileys-auth")
});

export type Environment = z.infer<typeof environmentSchema>;

export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  environmentSchema.parse(source);
