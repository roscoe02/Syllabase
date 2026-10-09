import { describe, expect, it } from "vitest";
import { sampleSyllabi } from "@/lib/demo/sample-courses";
import { neededOnRemaining, summarize } from "./calculator";
import { courseGradeInputs, gradeTargets, letterFor } from "./course-grades";

const [cs] = sampleSyllabi("2026-10-08", "Fall 2026"); // Homework 25 (drop 1), Midterms 40, Final 30, Participation 5

describe("courseGradeInputs", () => {
  const weights = [
    { component: "Homework", weight_percent: "25", is_guess: false, drop_lowest: 1 },
    { component: "Midterms", weight_percent: 40, is_guess: false, drop_lowest: 0 },
    { component: "Final exam", weight_percent: 30, is_guess: false, drop_lowest: 0 },
  ];
  const entries = [
    { component: "Homework", earned: "9", possible: "10" },
    { component: "Homework", earned: 4, possible: 10 },
    { component: "Midterms", earned: 85, possible: 100 },
  ];

  it("combines syllabus weights with the student's scores", () => {
    const { components, unweighted } = courseGradeInputs(cs, weights, entries);
    expect(unweighted).toEqual(["Participation"]); // in the syllabus, but no saved weight
    const summary = summarize(components);
    expect(summary.gradedWeight).toBe(65);
    expect(summary.remainingWeight).toBe(30);
    expect(summary.isEstimate).toBe(false);
  });

  it("only drops the lowest score once every listed item is in", () => {
    const { components } = courseGradeInputs(cs, weights, entries);
    const homework = components.find((c) => c.name === "Homework")!;
    expect(homework.remainingCount).toBe(1); // 3 homeworks listed, 2 scored: 4/10 still counts
    expect(summarize([homework]).currentPercent).toBeCloseTo(65);
  });

  it("marks results that use a guessed weight", () => {
    const { components } = courseGradeInputs(cs, [...weights, { component: "Participation", weight_percent: 5, is_guess: true, drop_lowest: 0 }], entries);
    expect(summarize(components).isEstimate).toBe(true);
    expect(neededOnRemaining(components, 90)).toBeGreaterThan(90);
  });
});

describe("grade scale", () => {
  it("uses A, B and C from the syllabus scale, falling back to 90/80/70", () => {
    const withScale = { ...cs, grade_scale: [{ letter: "A", min_percent: 93 }, { letter: "A-", min_percent: 90 }, { letter: "B", min_percent: 83 }, { letter: "C", min_percent: 73 }] };
    expect(gradeTargets(withScale).map((t) => t.min_percent)).toEqual([93, 83, 73]);
    expect(gradeTargets(cs).map((t) => t.letter)).toEqual(["A", "B", "C"]);
    expect(letterFor(91, withScale)).toBe("A-");
    expect(letterFor(91, cs)).toBeNull();
  });
});
