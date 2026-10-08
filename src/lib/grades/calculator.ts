/**
 * Grade calculator: current grade from syllabus weights + scores the student enters, and
 * "what do I need on the rest to get an X?".
 *
 * Weights come from the parsed syllabus (`grading`), possibly edited by the student. Weights the
 * student guessed are flagged so the UI can show the result as an estimate.
 */

export interface ComponentInput {
  name: string;
  /** Percent of the final grade, e.g. 25 for 25%. */
  weight: number;
  /** True when the syllabus didn't state it and the student entered a guess. */
  weightIsGuess?: boolean;
  dropLowest?: number;
  /** Graded work so far. */
  scores: Array<{ earned: number; possible: number }>;
  /** How many more items of this component are still to come (for drop-lowest math). */
  remainingCount?: number;
}

export interface GradeSummary {
  /** Weighted percent over the components that have at least one score. */
  currentPercent: number | null;
  /** Total weight (in %) of components with scores. */
  gradedWeight: number;
  /** Weight still entirely ungraded. */
  remainingWeight: number;
  isEstimate: boolean;
}

function componentPercent(c: ComponentInput): number | null {
  if (c.scores.length === 0) return null;
  // Drop the lowest-percentage scores, but only once all items are in (no remaining work).
  const canDrop = (c.remainingCount ?? 0) === 0 ? Math.min(c.dropLowest ?? 0, c.scores.length - 1) : 0;
  const kept = [...c.scores]
    .sort((a, b) => a.earned / a.possible - b.earned / b.possible)
    .slice(canDrop);
  const earned = kept.reduce((s, x) => s + x.earned, 0);
  const possible = kept.reduce((s, x) => s + x.possible, 0);
  return possible > 0 ? (earned / possible) * 100 : null;
}

export function summarize(components: ComponentInput[]): GradeSummary {
  let weighted = 0;
  let gradedWeight = 0;
  for (const c of components) {
    const pct = componentPercent(c);
    if (pct === null) continue;
    weighted += pct * c.weight;
    gradedWeight += c.weight;
  }
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  return {
    currentPercent: gradedWeight > 0 ? weighted / gradedWeight : null,
    gradedWeight,
    remainingWeight: Math.max(0, totalWeight - gradedWeight),
    isEstimate: components.some((c) => c.weightIsGuess),
  };
}

/**
 * Average percent needed on all ungraded components to finish at `targetPercent`.
 * Returns null when nothing is left to grade. Values above 100 mean the target is out of reach.
 */
export function neededOnRemaining(components: ComponentInput[], targetPercent: number): number | null {
  const { currentPercent, gradedWeight, remainingWeight } = summarize(components);
  if (remainingWeight <= 0) return null;
  const totalWeight = gradedWeight + remainingWeight;
  const banked = (currentPercent ?? 0) * gradedWeight;
  return (targetPercent * totalWeight - banked) / remainingWeight;
}
