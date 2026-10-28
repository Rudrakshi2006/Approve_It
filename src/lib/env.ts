import "server-only";
import { z } from "zod";

const envSchema = z.object({
  EKLINK_URL: z.string().url("EKLINK_URL must be a valid URL"),
  EKLINK_ISSUER: z.string().url("EKLINK_ISSUER must be a valid URL"),
  EKLINK_CLIENT_ID: z.string().min(1, "EKLINK_CLIENT_ID must not be empty"),
  EKLINK_CLIENT_SECRET: z.string().min(1, "EKLINK_CLIENT_SECRET must not be empty"),
  EKLINK_REDIRECT_URI: z.string().url("EKLINK_REDIRECT_URI must be a valid URL"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  APP_SESSION_SECRET: z.string().refine(
    (val) => {
      // Must be at least 32 bytes when encoded
      return Buffer.byteLength(val, "utf8") >= 32;
    },
    { message: "APP_SESSION_SECRET must be at least 32 bytes" }
  ),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY must not be empty"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Returns validated environment variables lazily.
 * On failure, throws an error naming the invalid/missing variables
 * WITHOUT ever printing their actual values.
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missingOrInvalid = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${missingOrInvalid}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Reset cached env for testing purposes
 */
export function _resetEnvCache(): void {
  cachedEnv = null;
}
