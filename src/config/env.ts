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
  BAILEYS_AUTH_DIR: z.string().default(".baileys-auth"),
  BAILEYS_DASHBOARD_AUTH_TOKEN: z.string().default(""),
  META_TENANT_ID: z.string().default("tenant-demo"),
  META_PROVIDER_CONNECTION_ID: z.string().default("meta_demo_connection"),
  META_PROVIDER_DISPLAY_NAME: z.string().default("Local Meta Cloud API"),
  META_PHONE_NUMBER_ID: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  META_VERIFY_TOKEN: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  GATEWAY_SHARED_SECRET: z.string().default("test-shared-secret"),
  META_API_VERSION: z.string().default("v25.0"),
  META_BASE_URL: z.url().default("https://graph.facebook.com"),
  DEMO_WEBHOOK_CALLBACK_URL: z.string().default("http://localhost:9999/webhook"),
  DEMO_WEBHOOK_SECRET: z.string().default("demo-secret"),
  META_ACTIVATE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
});

export type Environment = z.infer<typeof environmentSchema>;

export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): Environment =>
  environmentSchema.parse(source);
