import { describe, expect, it } from "vitest";
import { neededOnRemaining, summarize } from "./calculator";

const comps = [
  { name: "HW", weight: 30, dropLowest: 1, remainingCount: 0, scores: [{ earned: 10, possible: 10 }, { earned: 5, possible: 10 }, { earned: 9, possible: 10 }] },
  { name: "Midterm", weight: 30, scores: [{ earned: 80, possible: 100 }] },
  { name: "Final", weight: 40, scores: [] },
];

describe("grade calculator", () => {
  it("drops the lowest score and weights components", () => {
    expect(summarize(comps)).toEqual({ currentPercent: 87.5, gradedWeight: 60, remainingWeight: 40, isEstimate: false });
  });
  it("solves for the score needed on what's left", () => {
    expect(neededOnRemaining(comps, 90)).toBeCloseTo(93.75);
  });
  it("doesn't drop scores while more items are coming", () => {
    expect(summarize([{ ...comps[0], remainingCount: 2 }]).currentPercent).toBeCloseTo(80);
  });
});
