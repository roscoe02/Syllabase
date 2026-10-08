import { z } from "zod";

/**
 * What we try to pull out of every syllabus. Every field is nullable on
 * purpose: professors leave things out, and the UI shows a "missing" chip
 * (and asks the student to fill it in) instead of us guessing.
 */

const DateOrNull = z
  .string()
  .nullable()
  .describe("ISO date YYYY-MM-DD, or null if the syllabus doesn't give one");

export const GradeComponent = z.object({
  name: z.string().describe('e.g. "Homework", "Midterm 1", "Final Exam"'),
  weight_percent: z.number().nullable(),
  drop_lowest: z.number().int().nullable().describe("How many lowest scores are dropped, if stated"),
  notes: z.string().nullable(),
});

export const GradedItem = z.object({
  title: z.string(),
  kind: z.enum(["exam", "quiz", "homework", "project", "paper", "lab", "presentation", "participation", "other"]),
  component: z.string().nullable().describe("Name of the GradeComponent this belongs to"),
  due_date: DateOrNull,
  due_time: z.string().nullable().describe("24h HH:MM local time if stated"),
  weight_percent: z.number().nullable().describe("This item's own weight if stated"),
  source_quote: z.string().describe("Short verbatim quote from the syllabus this came from"),
});

export const ScheduleEntry = z.object({
  week: z.number().int().nullable(),
  date: DateOrNull,
  topic: z.string(),
  readings: z.string().nullable(),
});

export const MeetingTime = z.object({
  days: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])),
  start: z.string().nullable().describe("24h HH:MM"),
  end: z.string().nullable().describe("24h HH:MM"),
  location: z.string().nullable(),
  kind: z.enum(["lecture", "lab", "recitation", "office_hours", "other"]),
});

export const ParsedSyllabus = z.object({
  course_code: z.string().nullable().describe('e.g. "CS 3345"'),
  section: z.string().nullable().describe('e.g. "001"'),
  course_title: z.string().nullable(),
  term: z.string().nullable().describe('e.g. "Fall 2026"'),
  instructor: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    office: z.string().nullable(),
  }),
  tas: z.array(z.object({ name: z.string(), email: z.string().nullable() })),
  meetings: z.array(MeetingTime),
  grading: z.array(GradeComponent),
  grade_scale: z
    .array(z.object({ letter: z.string(), min_percent: z.number() }))
    .describe("Letter-grade cutoffs if listed, else empty"),
  graded_items: z.array(GradedItem),
  schedule: z.array(ScheduleEntry),
  policies: z.object({
    late_work: z.string().nullable(),
    attendance: z.string().nullable(),
    ai_usage: z.string().nullable().describe("The course's stated policy on AI tools, verbatim if short"),
    makeup_exams: z.string().nullable(),
    curve: z.string().nullable(),
  }),
  required_materials: z.array(z.string()),
  missing: z
    .array(z.string())
    .describe("Things a student would expect that this syllabus does NOT state, e.g. 'final exam date', 'homework weights'"),
});

export type ParsedSyllabus = z.infer<typeof ParsedSyllabus>;

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
