import { z } from "zod";
import { MODELS } from "@/lib/ai/client";
import { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { checkFreshness } from "@/lib/syllabus/staleness";
import { syllabusToEvents } from "@/lib/syllabus/to-events";

/**
 * POST /api/syllabus/confirm  { documentId, courseId?, term, syllabus }
 * Saves the syllabus the student reviewed and edited: course, syllabus record, grade weights and
 * calendar events, in one transaction (public.save_syllabus, which runs under the caller's RLS).
 * Freshness is recomputed here; the client's verdict is never trusted.
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
  const { documentId, courseId, source, term, syllabus } = body.data;

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = profile?.timezone ?? "America/Chicago";

  const freshness = checkFreshness(syllabus, term);
  const events = syllabusToEvents(syllabus, tz);
  const weights = syllabus.grading
    .filter((g) => g.weight_percent != null)
    .map((g) => ({ component: g.name, weight_percent: g.weight_percent, drop_lowest: g.drop_lowest ?? 0 }));

  const { data, error } = await supabase.rpc("save_syllabus", {
    p_document_id: documentId,
    p_course: {
      code: syllabus.course_code,
      section: syllabus.section,
      title: syllabus.course_title,
      term: term.name,
      instructor_name: syllabus.instructor.name,
      instructor_email: syllabus.instructor.email,
    },
    p_parsed: syllabus,
    p_model: MODELS.default,
    p_source: source,
    p_freshness: freshness.status,
    p_freshness_reason: "reason" in freshness ? freshness.reason : null,
    p_weights: weights,
    p_events: events,
    p_course_id: courseId ?? null,
  });
  if (error || !data) return serverError("syllabus/confirm save", error, "Couldn't save the course. Please try again.");

  return Response.json({ courseId: data as string, events: events.length });
}
