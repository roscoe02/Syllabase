import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: BYPASSES row-level security. Only for trusted server jobs
 * (cron feed refresh, usage accounting, token-authenticated ICS export). Always
 * filter by user_id explicitly when using it.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}
