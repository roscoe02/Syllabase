import "server-only";
import { summarize } from "@/lib/grades/calculator";
import { courseGradeInputs } from "@/lib/grades/course-grades";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";

/**
 * Read helpers for pages. Always called with the user-scoped client from getCurrentUser(), so RLS
 * limits every query to the signed-in student's rows. Columns are listed explicitly (no select *).
 */

export interface CourseSummary {
  id: string;
  code: string | null;
  section: string | null;
  title: string | null;
  term: string | null;
  instructor_name: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  allDay: boolean;
  weightPercent: number | null;
  source: "syllabus" | "ics" | "manual";
  course: { id: string; code: string | null } | null;
}

export async function getProfile(supabase: SupabaseClient) {
  const { data } = await supabase.from("profiles").select("timezone, ics_export_token, display_name").maybeSingle();
  return { timezone: data?.timezone ?? "America/Chicago", icsToken: data?.ics_export_token ?? null, name: data?.display_name ?? null };
}

export async function listCourses(supabase: SupabaseClient): Promise<CourseSummary[]> {
  const { data } = await supabase.from("courses").select("id, code, section, title, term, instructor_name").order("code");
  return data ?? [];
}

export async function listEvents(supabase: SupabaseClient, fromIso: string, toIso: string): Promise<CalendarEvent[]> {
  const { data } = await supabase
    .from("events")
    .select("id, title, kind, starts_at, all_day, weight_percent, source, courses(id, code)")
    .is("replaced_by", null)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at")
    .limit(1000);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    startsAt: r.starts_at,
    allDay: r.all_day,
    weightPercent: r.weight_percent == null ? null : Number(r.weight_percent),
    source: r.source,
    course: (r.courses as unknown as { id: string; code: string | null } | null) ?? null,
  }));
}

/** Latest syllabus per course: what's missing, and whether it may be outdated. */
export async function listSyllabusStatus(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("syllabi")
    .select("course_id, freshness, parsed->missing, created_at")
    .order("created_at", { ascending: false });
  const latest = new Map<string, { freshness: string; missing: string[] }>();
  for (const r of data ?? []) {
    if (!latest.has(r.course_id)) latest.set(r.course_id, { freshness: r.freshness, missing: (r.missing as string[] | null) ?? [] });
  }
  return latest;
}

export async function getCourse(supabase: SupabaseClient, id: string) {
  const [{ data: course }, { data: syllabus }, { data: events }, { data: documents }, { data: weights }, { data: entries }] = await Promise.all([
    supabase.from("courses").select("id, code, section, title, term, instructor_name, instructor_email").eq("id", id).maybeSingle(),
    supabase
      .from("syllabi")
      .select("parsed, freshness, freshness_reason, source, created_at")
      .eq("course_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, title, kind, starts_at, all_day, weight_percent, source")
      .eq("course_id", id)
      .is("replaced_by", null)
      .order("starts_at"),
    supabase.from("documents").select("id, filename, kind, created_at").eq("course_id", id).order("created_at"),
    supabase.from("grade_weights").select("component, weight_percent, is_guess, drop_lowest").eq("course_id", id),
    supabase.from("grade_entries").select("id, component, title, earned, possible").eq("course_id", id).order("created_at"),
  ]);
  if (!course) return null;
  return {
    course,
    syllabus: syllabus
      ? { ...syllabus, parsed: syllabus.parsed as ParsedSyllabus }
      : null,
    events: events ?? [],
    documents: documents ?? [],
    weights: weights ?? [],
    entries: entries ?? [],
  };
}

/** Each course's grade so far from the student's scores, or null when there are none yet. */
export async function listCurrentGrades(supabase: SupabaseClient): Promise<Map<string, number | null>> {
  const [{ data: syllabi }, { data: weights }, { data: entries }] = await Promise.all([
    supabase.from("syllabi").select("course_id, parsed").order("created_at", { ascending: false }),
    supabase.from("grade_weights").select("course_id, component, weight_percent, is_guess, drop_lowest"),
    supabase.from("grade_entries").select("course_id, component, earned, possible"),
  ]);
  const parsed = new Map<string, ParsedSyllabus>();
  for (const s of syllabi ?? []) if (!parsed.has(s.course_id)) parsed.set(s.course_id, s.parsed as ParsedSyllabus);
  const grades = new Map<string, number | null>();
  for (const id of new Set((entries ?? []).map((e) => e.course_id as string))) {
    const { components } = courseGradeInputs(
      parsed.get(id) ?? null,
      (weights ?? []).filter((w) => w.course_id === id),
      (entries ?? []).filter((e) => e.course_id === id),
    );
    grades.set(id, summarize(components).currentPercent);
  }
  return grades;
}
