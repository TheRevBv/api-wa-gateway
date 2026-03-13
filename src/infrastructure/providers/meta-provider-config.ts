import { z } from "zod";

import { ApplicationError } from "../../application/errors/application-error";

const metaProviderConfigSchema = z.object({
  accessToken: z.string().min(1),
  verifyToken: z.string().min(1),
  appSecret: z.string().min(1),
  apiVersion: z.string().min(1),
  baseUrl: z.url().default("https://graph.facebook.com")
});

export type MetaProviderConfig = z.infer<typeof metaProviderConfigSchema>;

export const parseMetaProviderConfig = (config: Record<string, unknown>): MetaProviderConfig => {
  const parsed = metaProviderConfigSchema.safeParse(config);

  if (!parsed.success) {
    throw new ApplicationError("Meta provider connection is misconfigured", {
      code: "provider_connection_invalid",
      statusCode: 500
    });
  }

  return parsed.data;
};
