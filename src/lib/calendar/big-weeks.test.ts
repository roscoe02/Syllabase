import { describe, expect, it } from "vitest";
import { bigWeeks } from "./big-weeks";

const d = (s: string) => new Date(`${s}T17:00:00Z`); // noon in Chicago
const ev = (date: string, weightPercent: number | null) => ({ startsAt: d(date), weightPercent });

describe("bigWeeks", () => {
  it("keeps the heaviest weeks, in date order", () => {
    const weeks = bigWeeks([
      ev("2026-10-05", 5),
      ev("2026-10-14", 25),
      ev("2026-10-15", 20),
      ev("2026-10-16", null),
      ev("2026-10-21", 15),
      ev("2026-11-04", 30),
      ev("2026-12-08", 35),
    ], "America/Chicago", { limit: 3 });
    expect(weeks.map((w) => [w.weekStart, w.totalWeight])).toEqual([["2026-10-12", 45], ["2026-11-02", 30], ["2026-12-07", 35]]);
    expect(weeks[0].weighted).toHaveLength(2);
    expect(weeks[0].otherCount).toBe(1);
  });

  it("ignores light weeks", () => {
    expect(bigWeeks([ev("2026-10-05", 5), ev("2026-10-06", null)], "America/Chicago")).toEqual([]);
  });

  it("buckets by the student's time zone, not the server's", () => {
    // Sunday 11:59pm in Dallas is Monday 04:59 UTC: still the previous week.
    const [w] = bigWeeks([{ startsAt: new Date("2026-10-19T04:59:00Z"), weightPercent: 20 }], "America/Chicago");
    expect(w.weekStart).toBe("2026-10-12");
  });
});
