import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";

/**
 * Is this syllabus for the term the student selected?
 *
 * CourseBook (via Nebula `syllabus_uri`) often still serves last semester's file, so syllabi fetched
 * from there are always run through this check. An "outdated" or "unknown" result shows a banner
 * asking the student to upload the current syllabus; an upload always replaces a CourseBook copy.
 */
export type Freshness =
  | { status: "current" }
  | { status: "outdated"; reason: string }
  | { status: "unknown"; reason: string };

export interface TermWindow {
  /** e.g. "Fall 2026" */
  name: string;
  /** ISO dates YYYY-MM-DD */
  start: string;
  end: string;
}

const SEASONS = ["spring", "summer", "fall", "winter"] as const;

function normalizeTerm(term: string): string | null {
  const t = term.toLowerCase();
  const season = SEASONS.find((s) => t.includes(s));
  const year = t.match(/20\d{2}/)?.[0];
  return season && year ? `${season} ${year}` : null;
}

export function checkFreshness(syllabus: ParsedSyllabus, term: TermWindow): Freshness {
  const stated = syllabus.term ? normalizeTerm(syllabus.term) : null;
  const expected = normalizeTerm(term.name);
  if (stated && expected && stated !== expected) {
    return { status: "outdated", reason: `Syllabus says "${syllabus.term}", but you selected ${term.name}.` };
  }

  // Dated items mostly outside the term window also mean an old file.
  const dates = syllabus.graded_items.map((i) => i.due_date).filter((d): d is string => Boolean(d));
  if (dates.length >= 3) {
    const outside = dates.filter((d) => d < term.start || d > term.end).length;
    if (outside / dates.length > 0.5) {
      return { status: "outdated", reason: `Most due dates fall outside ${term.name}.` };
    }
  }

  if (!stated && dates.length < 3) {
    return { status: "unknown", reason: "The syllabus doesn't say which term it's for." };
  }
  return { status: "current" };
}
