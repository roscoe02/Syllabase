import "server-only";

/**
 * UTD Nebula API client (https://api.utdnebula.com, MIT-licensed, run by Nebula Labs).
 * Key: ask in https://discord.utdnebula.com with your use case. Sent as `x-api-key`.
 * Spec: https://github.com/UTDNebula/nebula-api/blob/develop/rest/docs/swagger.yaml
 * Responses are wrapped as { status, message, data }. List endpoints page with ?offset=N (20 per page).
 *
 * Credit "Data from UTD Nebula" anywhere this data is shown.
 */

const BASE = "https://api.utdnebula.com";

/** Grade arrays are 14 counts in this order. */
export const GRADE_LABELS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "W"] as const;

export interface NebulaMeeting {
  start_date: string;
  end_date: string;
  meeting_days: string[];
  start_time: string;
  end_time: string;
  modality: string;
  location?: { building: string; room: string; map_uri: string };
}

export interface NebulaSection {
  _id: string;
  section_number: string;
  academic_session: { name: string; start_date: string; end_date: string };
  meetings: NebulaMeeting[];
  professors: string[];
  instruction_mode: string;
  /** Public syllabus PDF, e.g. https://dox.utdallas.edu/syl152555 — lets us skip the upload step. */
  syllabus_uri: string;
}

export interface NebulaProfessor {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  office?: { building: string; room: string };
  office_hours?: NebulaMeeting[];
  profile_uri?: string;
}

async function nebula<T>(path: string, params?: Record<string, string>, revalidateSeconds = 60 * 60 * 24): Promise<T> {
  const url = new URL(path, BASE);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "x-api-key": process.env.NEBULA_API_KEY ?? "" },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) throw new Error(`Nebula ${path} -> ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

/** Sections of a course in a term, e.g. ("CS", "3345", "26F"). TODO: confirm the session-name format against the live API. */
export function findSections(prefix: string, number: string, term: string) {
  return nebula<NebulaSection[]>("/course/sections", {
    subject_prefix: prefix,
    course_number: number,
    "academic_session.name": term,
  });
}

export function getProfessor(id: string) {
  return nebula<NebulaProfessor>(`/professor/${id}`);
}

/** Per-semester grade distributions for a course (optionally narrowed to one professor). */
export function getGrades(q: { prefix: string; number: string; first_name?: string; last_name?: string }) {
  return nebula<Array<{ _id: string; grade_distribution: number[] }>>("/grades/semester", q as Record<string, string>);
}

/** Current UTD academic calendar (no-class days, drop deadlines, finals) parsed by Nebula. */
export function getAcademicCalendar() {
  return nebula<unknown>("/academicCalendars/current");
}
