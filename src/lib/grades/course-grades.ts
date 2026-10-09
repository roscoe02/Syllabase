import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import type { ComponentInput } from "./calculator";

/**
 * Turns a course's syllabus categories, saved weights and the student's scores into calculator input.
 * Weights come only from the syllabus or the student's own guesses; categories with neither are left out
 * and listed so the UI can ask for a guess.
 */

export interface WeightRow {
  component: string;
  weight_percent: number | string;
  is_guess: boolean;
  drop_lowest: number;
}

export interface EntryRow {
  component: string;
  earned: number | string;
  possible: number | string;
}

export function courseGradeInputs(parsed: ParsedSyllabus | null, weights: WeightRow[], entries: EntryRow[]) {
  const names = parsed?.grading.map((g) => g.name).filter(Boolean) ?? weights.map((w) => w.component);
  const components: ComponentInput[] = [];
  const unweighted: string[] = [];
  for (const name of [...new Set(names)]) {
    const weight = weights.find((w) => w.component === name);
    if (!weight) {
      unweighted.push(name);
      continue;
    }
    const scores = entries.filter((e) => e.component === name).map((e) => ({ earned: Number(e.earned), possible: Number(e.possible) }));
    // Drop-lowest only applies once every item is in; when the syllabus doesn't list the items, don't drop yet.
    const listed = parsed?.graded_items.filter((i) => i.component === name).length ?? 0;
    components.push({
      name,
      weight: Number(weight.weight_percent),
      weightIsGuess: weight.is_guess,
      dropLowest: weight.drop_lowest,
      scores,
      remainingCount: listed > 0 ? Math.max(0, listed - scores.length) : 1,
    });
  }
  return { components, unweighted };
}

const FALLBACK_SCALE = [
  { letter: "A", min_percent: 90 },
  { letter: "B", min_percent: 80 },
  { letter: "C", min_percent: 70 },
];

/** The letter grades to show "what you need" for: A, B and C from the syllabus scale when it has them. */
export function gradeTargets(parsed: ParsedSyllabus | null) {
  const scale = parsed?.grade_scale.length ? parsed.grade_scale : FALLBACK_SCALE;
  const plain = scale.filter((s) => ["A", "B", "C"].includes(s.letter.trim().toUpperCase()));
  return (plain.length ? plain : scale.slice(0, 3)).sort((a, b) => b.min_percent - a.min_percent);
}

/** The letter for a percentage on the course's scale, if it has one. */
export function letterFor(percent: number, parsed: ParsedSyllabus | null): string | null {
  const scale = [...(parsed?.grade_scale ?? [])].sort((a, b) => b.min_percent - a.min_percent);
  return scale.find((s) => percent >= s.min_percent)?.letter ?? null;
}
