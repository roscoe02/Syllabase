import { z } from "zod";
import { fetchFeed } from "@/lib/calendar/import-ics";
import { syncFeed } from "@/lib/calendar/sync-feed";
import { encryptSecret, hashSecret } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { UnsafeUrlError } from "@/lib/security/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/feeds/import  { url, provider?, label? }
 * Connects a Canvas/Blackboard/etc. calendar feed (URL encrypted at rest, never sent back to the browser)
 * and does the first sync (see syncFeed). Re-sync: daily cron + after the dashboard renders, at most hourly.
 */

const Body = z.object({
  url: z.string().trim().max(2048).regex(/^(https|webcal):\/\//i, "Must be an https:// or webcal:// link"),
  provider: z.enum(["canvas", "blackboard", "d2l", "moodle", "google", "outlook", "other"]).default("canvas"),
  label: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const limited = await rateLimit("feed", userId);
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { url, provider, label } = body.data;

  let events;
  try {
    events = await fetchFeed(url);
  } catch (err) {
    // Never echo or log the URL itself: it's a credential.
    const message =
      err instanceof UnsafeUrlError ? err.message : "Couldn't read that calendar link. Check that you copied the whole link.";
    return Response.json({ error: message }, { status: 400 });
  }

  // Saving the same link again (webcal:// or https://) keeps the existing feed.
  const urlHash = hashSecret(url.replace(/^webcal:\/\//i, "https://"));
  const { error: saveError } = await supabase
    .from("calendar_feeds")
    .upsert(
      { user_id: userId, url_encrypted: encryptSecret(url), url_hash: urlHash, provider, label },
      { onConflict: "user_id,url_hash", ignoreDuplicates: true },
    );
  if (saveError) return serverError("feeds/import save", saveError);
  const { data: feed, error: findError } = await supabase.from("calendar_feeds").select("id").eq("url_hash", urlHash).single();
  if (findError || !feed) return serverError("feeds/import find", findError);

  try {
    return Response.json(await syncFeed(createAdminClient(), feed.id, events));
  } catch (err) {
    return serverError("feeds/import sync", err, "Saved the link, but the first sync failed. It will retry automatically.");
  }
}
