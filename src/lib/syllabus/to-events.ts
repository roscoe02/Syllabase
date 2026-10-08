import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { zonedToUtc } from "@/lib/time";

/** Rows for public.events built from a reviewed syllabus. Items without a date stay off the calendar. */
export interface SyllabusEventRow {
  source_uid: string;
  kind: "exam" | "quiz" | "homework" | "project" | "paper" | "lab" | "other";
  title: string;
  description: string | null;
  starts_at: string;
  all_day: boolean;
  weight_percent: number | null;
}

const KIND_MAP: Record<ParsedSyllabus["graded_items"][number]["kind"], SyllabusEventRow["kind"]> = {
  exam: "exam",
  quiz: "quiz",
  homework: "homework",
  project: "project",
  paper: "paper",
  lab: "lab",
  presentation: "other",
  participation: "other",
  other: "other",
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

export function syllabusToEvents(syllabus: ParsedSyllabus, tz: string): SyllabusEventRow[] {
  const seen = new Map<string, number>();
  const rows: SyllabusEventRow[] = [];
  for (const item of syllabus.graded_items) {
    if (!item.due_date) continue;
    // Stable key so re-saving the same syllabus updates rows instead of duplicating them.
    const base = `${item.due_date}:${slug(item.title)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const allDay = !item.due_time;
    rows.push({
      source_uid: n === 1 ? base : `${base}:${n}`,
      kind: KIND_MAP[item.kind],
      title: item.title,
      description: item.component ? `Counts toward ${item.component}` : null,
      // All-day items are stored at local noon so they land on the right date in any nearby zone.
      starts_at: zonedToUtc(item.due_date, item.due_time ?? "12:00", tz).toISOString(),
      all_day: allDay,
      weight_percent: item.weight_percent ?? weightFromComponent(syllabus, item),
    });
  }
  return rows;
}

/**
 * An item inherits its component's weight only when it is the component's sole item ("Final Exam 30%").
 * We never split a component across several items: the syllabus didn't say they're equal.
 */
function weightFromComponent(syllabus: ParsedSyllabus, item: ParsedSyllabus["graded_items"][number]): number | null {
  if (!item.component) return null;
  const comp = syllabus.grading.find((g) => g.name === item.component);
  const siblings = syllabus.graded_items.filter((i) => i.component === item.component);
  return siblings.length === 1 ? (comp?.weight_percent ?? null) : null;
}
