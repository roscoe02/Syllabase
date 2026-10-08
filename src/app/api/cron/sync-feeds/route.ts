import { syncFeed } from "@/lib/calendar/sync-feed";
import { serverError } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/sync-feeds — daily Vercel Cron (vercel.json): re-syncs every connected calendar feed.
 * Students also get a re-sync after opening the dashboard (at most hourly). Requires `Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: feeds, error } = await admin.from("calendar_feeds").select("id");
  if (error) return serverError("cron/sync-feeds list", error);

  let failed = 0;
  for (const f of feeds ?? []) {
    try {
      await syncFeed(admin, f.id);
    } catch (err) {
      failed++;
      console.error("cron/sync-feeds", err instanceof Error ? err.name : err);
    }
  }
  return Response.json({ synced: (feeds?.length ?? 0) - failed, failed });
}
