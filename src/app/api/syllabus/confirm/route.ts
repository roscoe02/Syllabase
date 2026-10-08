import { after } from "next/server";
import { z } from "zod";
import { MODELS } from "@/lib/ai/client";
import { dropInvalidDates, ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { matchCourseForSyllabus } from "@/lib/calendar/match";
import { syncStaleFeeds } from "@/lib/calendar/sync-feed";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSyllabus } from "@/lib/syllabus/save";

/**
 * POST /api/syllabus/confirm  { documentId, courseId?, term, syllabus }
 * Saves the syllabus the student reviewed and edited (see saveSyllabus). Freshness is recomputed
 * on the server; the client's verdict is never trusted.
 */

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Body = z.object({
  documentId: z.uuid().nullable(),
  courseId: z.uuid().optional(),
  source: z.enum(["upload", "coursebook"]).default("upload"),
  term: z.object({ name: z.string().trim().min(1).max(40), start: IsoDate, end: IsoDate }),
  syllabus: ParsedSyllabus.refine((s) => s.graded_items.length <= 300 && s.grading.length <= 50, "Too many items"),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const body = await parseBody(request, Body, 300 * 1024);
  if ("error" in body) return body.error;
  const { documentId, courseId, source, term } = body.data;
  const syllabus = dropInvalidDates(body.data.syllabus);

  const [{ data: profile }, { data: courses }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    supabase.from("courses").select("id, code, section, canvas_key"),
  ]);
  const tz = profile?.timezone ?? "America/Chicago";
  // A course that already exists (from a Canvas feed, or an earlier upload) gets this syllabus instead of a twin.
  const existing = courseId ? null : matchCourseForSyllabus(courses ?? [], syllabus.course_code, syllabus.section);

  const { courseId: savedId, events, error } = await saveSyllabus(supabase, {
    syllabus,
    term,
    tz,
    model: MODELS.default,
    documentId,
    courseId: courseId ?? existing?.id,
    source,
  });
  if (error || !savedId) return serverError("syllabus/confirm save", error, "Couldn't save the course. Please try again.");

  // Pair the new syllabus items with Canvas items right away instead of at the next sync.
  after(() => syncStaleFeeds(createAdminClient(), userId, { force: true }));
  return Response.json({ courseId: savedId, events });
}
