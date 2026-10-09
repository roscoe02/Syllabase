import { z } from "zod";
import { Change, MAX_CHANGES } from "@/lib/calendar/quick-add";
import { getProfile } from "@/lib/data/queries";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { zonedToUtc } from "@/lib/time";

/**
 * POST /api/quick-add/confirm  { changes }
 * Saves the quick-add changes the student approved. User-scoped client, so RLS limits every write to their own
 * rows and courses. Canvas items are never edited here: the next sync would undo it.
 */

const Body = z.object({ changes: z.array(Change).min(1).max(MAX_CHANGES) });

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const limited = await rateLimit("calendar", userId);
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { timezone: tz } = await getProfile(supabase);
  // All-day items are stored at local noon, like syllabus items.
  const startsAt = (c: Change) => zonedToUtc(c.date!, c.time ?? "12:00", tz).toISOString();

  const adds = body.data.changes.filter((c) => c.action === "add" && c.date);
  const edits = body.data.changes.filter((c) => c.action !== "add" && c.eventId && (c.action === "remove" || c.date));

  // Moves and removals first: repeating them is harmless, so a retry after a failure can't duplicate the adds.
  const results = await Promise.all(
    edits.map((c) =>
      (c.action === "remove" ? supabase.from("events").delete() : supabase.from("events").update({ starts_at: startsAt(c), all_day: !c.time }))
        .eq("id", c.eventId!)
        .neq("source", "ics")
        .select("id"),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed) return serverError("quick add edit", failed.error);
  let saved = results.reduce((n, r) => n + (r.data?.length ?? 0), 0);

  if (adds.length) {
    const { error } = await supabase.from("events").insert(
      adds.map((c) => ({
        user_id: userId,
        course_id: c.courseId,
        source: "manual",
        kind: c.kind,
        title: c.title,
        starts_at: startsAt(c),
        all_day: !c.time,
        weight_percent: c.weightPercent,
      })),
    );
    if (error) return serverError("quick add insert", error);
    saved += adds.length;
  }
  return Response.json({ saved });
}
