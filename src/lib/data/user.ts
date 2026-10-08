import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data access layer entry point for pages: the signed-in user, verified on the server.
 * Reads cookies, so call it only inside a <Suspense> boundary (cache components rule).
 * Redirects to /login when there's no valid session.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { supabase, id: claims.sub, email: (claims.email as string | undefined) ?? null };
}
