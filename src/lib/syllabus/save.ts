import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { checkFreshness, type TermWindow } from "./staleness";
import { syllabusToEvents } from "./to-events";

/**
 * Saves a reviewed syllabus: course, syllabus record, grade weights and calendar events in one
 * transaction (public.save_syllabus, which runs under the caller's RLS). Freshness is computed here.
 */
export async function saveSyllabus(
  supabase: SupabaseClient,
  input: {
    syllabus: ParsedSyllabus;
    term: TermWindow;
    tz: string;
    model: string;
    documentId?: string | null;
    courseId?: string | null;
    source?: "upload" | "coursebook";
  },
) {
  const { syllabus, term, tz } = input;
  const freshness = checkFreshness(syllabus, term);
  const events = syllabusToEvents(syllabus, tz);
  const weights = syllabus.grading
    .filter((g) => g.weight_percent != null)
    .map((g) => ({ component: g.name, weight_percent: g.weight_percent, drop_lowest: g.drop_lowest ?? 0 }));

  const { data, error } = await supabase.rpc("save_syllabus", {
    p_document_id: input.documentId ?? null,
    p_course: {
      code: syllabus.course_code,
      section: syllabus.section,
      title: syllabus.course_title,
      term: term.name,
      instructor_name: syllabus.instructor.name,
      instructor_email: syllabus.instructor.email,
    },
    p_parsed: syllabus,
    p_model: input.model,
    p_source: input.source ?? "upload",
    p_freshness: freshness.status,
    p_freshness_reason: "reason" in freshness ? freshness.reason : null,
    p_weights: weights,
    p_events: events,
    p_course_id: input.courseId ?? null,
  });
  return { courseId: (data as string | null) ?? null, events: events.length, error };
}
