import { dateKey, mondayOfKey } from "@/lib/time";

/**
 * "Big weeks ahead": the weeks where the most graded work comes due, so crunch time isn't a surprise.
 * Weeks start on Monday in the student's time zone. Each item's weight is its share of its own course's
 * grade, so the total is only used to rank weeks.
 */

export interface WeightedEvent {
  startsAt: Date | string;
  weightPercent: number | null;
}

export interface BigWeek<E> {
  /** Monday of the week, YYYY-MM-DD, in the student's time zone. */
  weekStart: string;
  totalWeight: number;
  /** Items with a known weight, in the order given (callers pass events sorted by date). */
  weighted: E[];
  /** Other items due that week, with no known weight. */
  otherCount: number;
}

export function bigWeeks<E extends WeightedEvent>(
  events: E[],
  tz: string,
  { limit = 3, minWeight = 15 }: { limit?: number; minWeight?: number } = {},
): BigWeek<E>[] {
  const weeks = new Map<string, BigWeek<E>>();
  for (const e of events) {
    const key = mondayOfKey(dateKey(new Date(e.startsAt), tz));
    const w = weeks.get(key) ?? { weekStart: key, totalWeight: 0, weighted: [], otherCount: 0 };
    if (e.weightPercent == null) w.otherCount += 1;
    else {
      w.totalWeight += e.weightPercent;
      w.weighted.push(e);
    }
    weeks.set(key, w);
  }
  return [...weeks.values()]
    .filter((w) => w.totalWeight >= minWeight)
    .sort((a, b) => b.totalWeight - a.totalWeight)
    .slice(0, limit)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
