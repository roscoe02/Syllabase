import { z } from "zod";
import { fetchFeed } from "@/lib/calendar/import-ics";
import { encryptSecret, hashSecret } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { UnsafeUrlError } from "@/lib/security/safe-fetch";

/**
 * POST /api/feeds/import  { url, provider?, label? }
 * Saves a Canvas/Blackboard/etc. calendar feed (URL encrypted at rest, never sent back to the
 * browser) and does a first sync.
 * Re-sync: daily Vercel Cron (Hobby limit) + on dashboard open, throttled to once an hour per feed.
 *
 * TODO: match ImportedEvent.courseCode to the user's courses (create courses for unknown codes).
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
  const { error: feedError } = await supabase.from("calendar_feeds").upsert(
    {
      user_id: userId,
      url_encrypted: encryptSecret(url),
      url_hash: hashSecret(url.replace(/^webcal:\/\//i, "https://")),
      provider,
      label,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "user_id,url_hash", ignoreDuplicates: true },
  );
  if (feedError) return serverError("feeds/import insert feed", feedError);

  const { error } = await supabase.from("events").upsert(
    events.map((e) => ({
      user_id: userId,
      source: "ics",
      source_uid: e.sourceUid,
      kind: e.kind,
      title: e.title.slice(0, 300),
      description: e.description?.slice(0, 5000) ?? null,
      url: e.url && /^https:\/\//i.test(e.url) ? e.url : null,
      starts_at: e.startsAt.toISOString(),
      ends_at: e.endsAt?.toISOString() ?? null,
      all_day: e.allDay,
    })),
    { onConflict: "user_id,source,source_uid" },
  );
  if (error) return serverError("feeds/import upsert events", error);

  return Response.json({ imported: events.length });
}
