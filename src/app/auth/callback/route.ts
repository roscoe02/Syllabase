import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/security/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback?code=...&next=/dashboard
 * Finishes Google/Microsoft OAuth and email magic links (PKCE): exchanges the one-time code for a
 * session cookie, then sends the user on. `next` must be a same-site path (no open redirects).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
