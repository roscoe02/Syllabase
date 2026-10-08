import { z } from "zod";

/**
 * What we try to pull out of every syllabus. Professors leave things out, so most fields can be
 * missing, and the UI shows a "missing" chip (and asks the student to fill it in) instead of us guessing.
 *
 * Two variants share one shape:
 * - ParsedSyllabus: what the app stores and edits. Missing text is null.
 * - ExtractedSyllabus: what Claude fills in. Missing text is "", because the API allows only 16
 *   nullable fields per schema. fromExtracted() turns "" back into null.
 */
function syllabusSchema<T extends z.ZodType<string | null>>(text: () => T) {
  const date = () => text().describe("ISO date YYYY-MM-DD if the syllabus gives one");

  return z.object({
    course_code: text().describe('e.g. "CS 3345"'),
    section: text().describe('e.g. "001"'),
    course_title: text(),
    term: text().describe('e.g. "Fall 2026"'),
    instructor: z.object({ name: text(), email: text(), office: text() }),
    tas: z.array(z.object({ name: z.string(), email: text() })),
    meetings: z.array(
      z.object({
        days: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])),
        start: text().describe("24h HH:MM"),
        end: text().describe("24h HH:MM"),
        location: text(),
        kind: z.enum(["lecture", "lab", "recitation", "office_hours", "other"]),
      }),
    ),
    grading: z.array(
      z.object({
        name: z.string().describe('e.g. "Homework", "Midterm 1", "Final Exam"'),
        weight_percent: z.number().nullable(),
        drop_lowest: z.number().int().nullable().describe("How many lowest scores are dropped, if stated"),
        notes: text(),
      }),
    ),
    grade_scale: z
      .array(z.object({ letter: z.string(), min_percent: z.number() }))
      .describe("Letter-grade cutoffs if listed, else empty"),
    graded_items: z.array(
      z.object({
        title: z.string(),
        kind: z.enum(["exam", "quiz", "homework", "project", "paper", "lab", "presentation", "participation", "other"]),
        component: text().describe("Name of the grading category this belongs to"),
        due_date: date(),
        due_time: text().describe("24h HH:MM local time if stated"),
        weight_percent: z.number().nullable().describe("This item's own weight if stated"),
        source_quote: z.string().describe("Short verbatim quote from the syllabus this came from"),
      }),
    ),
    schedule: z.array(
      z.object({ week: z.number().int().nullable(), date: date(), topic: z.string(), readings: text() }),
    ),
    policies: z.object({
      late_work: text(),
      attendance: text(),
      ai_usage: text().describe("The course's stated policy on AI tools, verbatim if short"),
      makeup_exams: text(),
      curve: text(),
    }),
    required_materials: z.array(z.string()),
    missing: z
      .array(z.string())
      .describe("Things a student would expect that this syllabus does NOT state, e.g. 'final exam date', 'homework weights'"),
  });
}

export const ParsedSyllabus = syllabusSchema(() => z.string().nullable());
export type ParsedSyllabus = z.infer<typeof ParsedSyllabus>;

export const ExtractedSyllabus = syllabusSchema(() => z.string());
export type ExtractedSyllabus = z.infer<typeof ExtractedSyllabus>;

const orNull = (s: string) => (s.trim() === "" ? null : s);

/** Claude's answer in the app's shape: every optional text field that came back "" becomes null. */
export function fromExtracted(e: ExtractedSyllabus): ParsedSyllabus {
  return {
    ...e,
    course_code: orNull(e.course_code),
    section: orNull(e.section),
    course_title: orNull(e.course_title),
    term: orNull(e.term),
    instructor: { name: orNull(e.instructor.name), email: orNull(e.instructor.email), office: orNull(e.instructor.office) },
    tas: e.tas.map((t) => ({ ...t, email: orNull(t.email) })),
    meetings: e.meetings.map((m) => ({ ...m, start: orNull(m.start), end: orNull(m.end), location: orNull(m.location) })),
    grading: e.grading.map((g) => ({ ...g, notes: orNull(g.notes) })),
    graded_items: e.graded_items.map((i) => ({
      ...i,
      component: orNull(i.component),
      due_date: orNull(i.due_date),
      due_time: orNull(i.due_time),
    })),
    schedule: e.schedule.map((s) => ({ ...s, date: orNull(s.date), readings: orNull(s.readings) })),
    policies: {
      late_work: orNull(e.policies.late_work),
      attendance: orNull(e.policies.attendance),
      ai_usage: orNull(e.policies.ai_usage),
      makeup_exams: orNull(e.policies.makeup_exams),
      curve: orNull(e.policies.curve),
    },
  };
}

const isIsoDate = (d: string) => {
  const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00Z`) : NaN;
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
};
const isHhMm = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/**
 * Dates and times arrive as free strings (from the model or the review form). Anything that isn't a
 * real YYYY-MM-DD / HH:MM becomes null, so it shows as missing instead of breaking the calendar.
 */
export function dropInvalidDates(s: ParsedSyllabus): ParsedSyllabus {
  return {
    ...s,
    graded_items: s.graded_items.map((i) => ({
      ...i,
      due_date: i.due_date && isIsoDate(i.due_date) ? i.due_date : null,
      due_time: i.due_time && isHhMm(i.due_time) ? i.due_time : null,
    })),
  };
}
