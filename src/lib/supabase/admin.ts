import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

// Local Supabase's well-known service role key — safe to commit, it only works
// against a local dev instance. Production must provide SUPABASE_SERVICE_ROLE_KEY.
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const isLocalSupabase =
  supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

/**
 * Service-role Supabase client. Bypasses RLS — use only on the server for
 * privileged work (allowlist checks, provisioning a new member's journal,
 * stamping auth claims). Never expose to the browser.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Only fall back to the committed local key when we're genuinely pointed at
    // a local Supabase instance. Against any remote DB, refuse loudly — handing
    // the local key to a remote project yields a baffling "Invalid API key".
    if (!isLocalSupabase) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required when not targeting a local Supabase instance."
      );
    }
    return createClient(supabaseUrl, LOCAL_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
