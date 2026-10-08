import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. Only ever uses the public (RLS-protected) key. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
