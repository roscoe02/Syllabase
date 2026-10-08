import { describe, expect, it } from "vitest";
import { crunchWeeks, weeklyLoad } from "./crunch";

const d = (s: string) => new Date(`${s}T17:00:00Z`); // noon in Chicago

describe("crunch weeks", () => {
  it("sums weight per week and flags heavy weeks", () => {
    const loads = weeklyLoad([
      { startsAt: d("2026-10-05"), weightPercent: 5, courseId: null },
      { startsAt: d("2026-10-14"), weightPercent: 25, courseId: null },
      { startsAt: d("2026-10-15"), weightPercent: 20, courseId: null },
      { startsAt: d("2026-10-21"), weightPercent: 5, courseId: null },
      { startsAt: d("2026-10-28"), weightPercent: null, courseId: null },
    ], "America/Chicago");
    expect(loads.map((l) => [l.weekStart, l.totalWeight])).toEqual([["2026-10-05", 5], ["2026-10-12", 45], ["2026-10-19", 5], ["2026-10-26", 0]]);
    expect(loads[3].unweightedCount).toBe(1);
    expect(crunchWeeks(loads).map((w) => w.weekStart)).toEqual(["2026-10-12"]);
  });
  it("buckets by the student's time zone, not the server's", () => {
    // Sunday 11:59pm in Dallas is Monday 04:59 UTC: still the previous week.
    const [w] = weeklyLoad([{ startsAt: new Date("2026-10-19T04:59:00Z"), weightPercent: 10, courseId: null }], "America/Chicago");
    expect(w.weekStart).toBe("2026-10-12");
  });
});
