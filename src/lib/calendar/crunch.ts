import { dateKey, mondayOfKey } from "@/lib/time";

/**
 * Crunch-week heatmap: total grade weight due per week, across all courses.
 * Items without a known weight count toward `unweightedCount` so a week full of
 * "weight unknown" work still shows up as busy.
 */

export interface WeightedEvent {
  startsAt: Date;
  weightPercent: number | null;
  courseId: string | null;
}

export interface WeekLoad {
  /** Monday of the week, YYYY-MM-DD, in the student's time zone. */
  weekStart: string;
  totalWeight: number;
  unweightedCount: number;
  eventCount: number;
}

export function weeklyLoad(events: WeightedEvent[], tz: string): WeekLoad[] {
  const weeks = new Map<string, WeekLoad>();
  for (const e of events) {
    const key = mondayOfKey(dateKey(e.startsAt, tz));
    const w = weeks.get(key) ?? { weekStart: key, totalWeight: 0, unweightedCount: 0, eventCount: 0 };
    w.eventCount += 1;
    if (e.weightPercent == null) w.unweightedCount += 1;
    else w.totalWeight += e.weightPercent;
    weeks.set(key, w);
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** A week is a crunch week when its total weight is well above the semester's typical week. */
export function crunchWeeks(loads: WeekLoad[], threshold = 1.75): WeekLoad[] {
  const weighted = loads.filter((l) => l.totalWeight > 0).map((l) => l.totalWeight);
  if (weighted.length === 0) return [];
  const sorted = [...weighted].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return loads.filter((l) => l.totalWeight >= Math.max(15, median * threshold));
}
