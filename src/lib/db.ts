import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

let supabaseAdminClient: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!supabaseAdminClient) {
    const env = getEnv();
    supabaseAdminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminClient;
}

/**
 * Resets db client (primarily for testing with mocks)
 */
export function _resetDb(): void {
  supabaseAdminClient = null;
}
