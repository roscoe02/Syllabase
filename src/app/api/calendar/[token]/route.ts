import { buildIcs } from "@/lib/calendar/export-ics";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/calendar/<ics_export_token>.ics — the student's subscribable calendar.
 * Calendar apps can't send cookies, so the unguessable 192-bit token in the URL is the credential.
 * The admin client is required (no user session), so every query is filtered by the token's owner.
 * Settings can regenerate the token (public.regenerate_ics_token) if a link leaks.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = await rateLimit("export", ip);
  if (limited) return limited;

  const token = (await ctx.params).token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("ics_export_token", token)
    .maybeSingle();
  if (!profile) return new Response("Not found", { status: 404 });

  const { data: rows } = await supabase
    .from("events")
    .select("id, title, description, url, starts_at, ends_at, all_day, courses(code)")
    .eq("user_id", profile.id)
    .is("replaced_by", null)
    .gte("starts_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString());

  const body = buildIcs(
    (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      courseCode: (r.courses as unknown as { code: string | null } | null)?.code ?? null,
      description: r.description,
      url: r.url,
      startsAt: new Date(r.starts_at),
      endsAt: r.ends_at ? new Date(r.ends_at) : null,
      allDay: r.all_day,
    })),
    profile.timezone,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
