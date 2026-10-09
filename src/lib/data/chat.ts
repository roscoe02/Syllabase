import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCourseContext } from "@/lib/ai/course-context";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { getProfile } from "./queries";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Course materials for the assistant, for one course or all of them: parsed syllabus facts and the calendar
 * from two weeks back to five months ahead, plus the syllabus PDF itself for a single course. User-scoped
 * client, so RLS limits it to the student's own data.
 */
export async function loadCourseContext(supabase: SupabaseClient, courseId: string | null) {
  const { timezone: tz } = await getProfile(supabase);
  const now = new Date();

  let courses = supabase.from("courses").select("id, code, section, title, term, instructor_name, instructor_email").order("code");
  let syllabi = supabase.from("syllabi").select("course_id, parsed, document_id").order("created_at", { ascending: false });
  let events = supabase
    .from("events")
    .select("course_id, title, kind, starts_at, all_day, weight_percent, source")
    .is("replaced_by", null)
    .gte("starts_at", new Date(now.getTime() - 14 * DAY).toISOString())
    .lt("starts_at", new Date(now.getTime() + 150 * DAY).toISOString())
    .order("starts_at")
    .limit(400);
  if (courseId) {
    courses = courses.eq("id", courseId);
    syllabi = syllabi.eq("course_id", courseId);
    events = events.eq("course_id", courseId);
  }
  const [{ data: courseRows }, { data: syllabusRows }, { data: eventRows }] = await Promise.all([courses, syllabi, events]);

  const latest = new Map<string, ParsedSyllabus>();
  let documentId: string | null = null;
  for (const s of syllabusRows ?? []) {
    if (latest.has(s.course_id)) continue;
    latest.set(s.course_id, s.parsed as ParsedSyllabus);
    documentId ??= s.document_id;
  }

  // The file answers what the parsed data doesn't (office hours, topics). One course only, to bound the cost.
  let pdf: string | null = null;
  if (courseId && documentId) {
    const { data: doc } = await supabase.from("documents").select("storage_path, mime_type").eq("id", documentId).maybeSingle();
    if (doc?.mime_type === "application/pdf") {
      const { data: file } = await supabase.storage.from("documents").download(doc.storage_path);
      if (file) pdf = Buffer.from(await file.arrayBuffer()).toString("base64");
    }
  }

  return {
    text: formatCourseContext({ courses: courseRows ?? [], syllabi: latest, events: eventRows ?? [], tz, now }),
    pdf,
  };
}
