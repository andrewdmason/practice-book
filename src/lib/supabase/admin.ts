import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

// Local Supabase's well-known service role key — safe to commit, it only works
// against a local dev instance. Production must provide SUPABASE_SERVICE_ROLE_KEY.
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const env = process.env.NEXT_PUBLIC_SUPABASE_ENV;

/**
 * Service-role Supabase client. Bypasses RLS — use only on the server for
 * privileged work (allowlist checks, provisioning a new member's journal,
 * stamping auth claims). Never expose to the browser.
 */
export function createAdminClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (env === "production" ? undefined : LOCAL_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to provision accounts in production."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
