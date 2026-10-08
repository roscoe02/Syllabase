/**
 * Matching LMS calendar items (Canvas, Blackboard, ...) to the student's courses and syllabus items.
 * Pure functions: no I/O, so they're easy to test against real feed titles.
 */

export interface CourseKey {
  /** "4337.007": the course number and section, which every format below shares. */
  key: string;
  /** Subjects in the code, e.g. ["CE", "CS"] for a cross-listed course. */
  subjects: string[];
  number: string;
  section: string;
}

const CODE = /([A-Z]{2,4})[\s-]?(\d{4})\.(\w{3})/g;

/**
 * Parses the code Canvas puts after each title: "CS 4392.001 - F26", "CE-4337.007-CS-4337.007 - F26",
 * "CS 4485.0W1 - F26". Returns null when there's no course number and section.
 */
export function parseCourseCode(raw: string | null): CourseKey | null {
  if (!raw) return null;
  const matches = [...raw.toUpperCase().matchAll(CODE)];
  if (matches.length === 0) return null;
  const [, , number, section] = matches[0];
  return { key: `${number}.${section}`, subjects: [...new Set(matches.map((m) => m[1]))], number, section };
}

export interface CourseRef {
  id: string;
  code: string | null;
  section: string | null;
  canvas_key: string | null;
}

/** The student's course for a feed code: by stored key, else by course number + section (section may be unknown). */
export function matchCourse(courses: CourseRef[], code: CourseKey): CourseRef | null {
  return (
    courses.find((c) => c.canvas_key === code.key) ??
    courses.find(
      (c) =>
        c.code?.match(/\d{4}/)?.[0] === code.number &&
        (c.section == null || c.section.toUpperCase() === code.section),
    ) ??
    null
  );
}

/** Same matching for a syllabus being saved, so a course created from a feed gets its syllabus instead of a twin. */
export function matchCourseForSyllabus(courses: CourseRef[], code: string | null, section: string | null): CourseRef | null {
  const number = code?.match(/\d{4}/)?.[0];
  if (!number) return null;
  return matchCourse(courses, { key: `${number}.${(section ?? "").toUpperCase()}`, subjects: [], number, section: (section ?? "").toUpperCase() });
}

/** Drops a leading course code from a feed title: "CS 4337- Quiz 3" -> "Quiz 3". */
export function stripCoursePrefix(title: string): string {
  return title.replace(/^\s*[A-Z]{2,4}[\s-]?\d{4}(\.\w{3})?\s*[-:]\s*/i, "").trim() || title;
}

const SYNONYMS: Record<string, string> = { hw: "homework", hws: "homework", assignments: "assignment", exam: "exam", exams: "exam", midterms: "midterm", quizzes: "quiz", projects: "project" };

function tokens(title: string) {
  const words = stripCoursePrefix(title)
    .replace(/\([^)]*\)/g, " ") // "(59.- UTDallas - CS Project - T3)": section notes, not part of the name
    .toLowerCase()
    .replace(/mid-term/g, "midterm")
    .replace(/([a-z])(\d)/g, "$1 $2") // "homework1" -> "homework 1"
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w);
  return {
    numbers: new Set(words.filter((w) => /^\d+$/.test(w)).map((n) => String(Number(n)))),
    words: new Set(words.filter((w) => !/^\d+$/.test(w) && w.length > 2)),
  };
}

/**
 * Do two titles name the same graded item? The numbers must agree exactly ("Assignment 1" is not "Assignment 2",
 * "Quiz 3" is not the "Quizzes" category) and at least half their words must overlap ("Midterm" matches
 * "Midterm Exam" but not "Midterm Peer Evaluation").
 */
export function sameItem(a: string, b: string): boolean {
  const x = tokens(a);
  const y = tokens(b);
  if (x.numbers.size !== y.numbers.size || [...x.numbers].some((n) => !y.numbers.has(n))) return false;
  const shared = [...x.words].filter((w) => y.words.has(w)).length;
  return shared > 0 && shared / new Set([...x.words, ...y.words]).size >= 0.5;
}

export interface SyllabusItemRef {
  title: string;
  /** YYYY-MM-DD when the syllabus dates it. */
  date: string | null;
  weightPercent: number | null;
  /** The calendar event for a dated item. */
  eventId: string | null;
}

const MAX_DATE_GAP_DAYS = 7;

/**
 * The syllabus item a feed item stands for, if any. Dated items must be within a week (dates move, and the feed
 * is the more current source); when several match, the closest date wins.
 */
export function findSyllabusItem(feedTitle: string, feedDate: string, items: SyllabusItemRef[]): SyllabusItemRef | null {
  const gap = (d: string) => Math.abs(Date.parse(`${d}T00:00:00Z`) - Date.parse(`${feedDate}T00:00:00Z`)) / 86_400_000;
  const candidates = items
    .filter((i) => sameItem(feedTitle, i.title))
    .filter((i) => i.date == null || gap(i.date) <= MAX_DATE_GAP_DAYS)
    .sort((a, b) => (a.date == null ? 99 : gap(a.date)) - (b.date == null ? 99 : gap(b.date)));
  return candidates[0] ?? null;
}

const SEASONS: Record<string, string> = { F: "Fall", S: "Spring", U: "Summer" };

/** "CS 4392.001 - F26" -> "Fall 2026", when the feed says. */
export function termFromCode(raw: string | null): string | null {
  const m = raw?.match(/\b([FSU])(\d{2})\b/);
  return m ? `${SEASONS[m[1]]} 20${m[2]}` : null;
}
