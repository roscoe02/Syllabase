import { describe, expect, it } from "vitest";
import { describeWhen, resolveChanges, type QuickAddOutput } from "./quick-add";

const C1 = "11111111-1111-4111-8111-111111111111";
const E1 = "22222222-2222-4222-8222-222222222222";
const E2 = "33333333-3333-4333-8333-333333333333";
const courses = [{ ref: "c1", id: C1, label: "CS 3345" }];
const events = [
  { ref: "e1", id: E1, title: "Midterm 2", kind: "exam", courseId: C1, editable: true },
  { ref: "e2", id: E2, title: "Homework 6", kind: "homework", courseId: C1, editable: false }, // from Canvas
];
const change = (c: Partial<QuickAddOutput["changes"][number]>): QuickAddOutput["changes"][number] => ({
  action: "add", event: "", course: "", title: "", date: "", time: "", kind: "other", weight_percent: null, ...c,
});

describe("resolveChanges", () => {
  it("maps refs to ids and keeps only changes that check out", () => {
    const out: QuickAddOutput = {
      reply: "",
      changes: [
        change({ action: "add", course: "c1", title: "Quiz 4", date: "2026-10-16", time: "10:00", kind: "quiz" }),
        change({ action: "move", event: "e1", date: "2026-11-19", time: "" }),
        change({ action: "remove", event: "e2" }), // Canvas items are read-only
        change({ action: "move", event: "e9", date: "2026-11-19" }), // not shown to Claude
        change({ action: "add", title: "Bad date", date: "2026-02-30" }),
        change({ action: "add", course: "c7", title: "No course ref", date: "2026-10-20", time: "25:00", weight_percent: 140 }),
        change({ action: "add", course: "cs 3345", title: "Study group", date: "2026-10-21", time: "18:00" }),
      ],
    };
    const res = resolveChanges(out, courses, events, null);
    expect(res).toHaveLength(4);
    expect(res[3].courseId).toBe(C1); // named instead of referenced
    expect(res[0]).toMatchObject({ action: "add", courseId: C1, courseLabel: "CS 3345", time: "10:00", kind: "quiz" });
    expect(res[1]).toMatchObject({ action: "move", eventId: E1, title: "Midterm 2", date: "2026-11-19", time: null, kind: "exam" });
    expect(res[2]).toMatchObject({ courseId: null, time: null, weightPercent: null });
  });

  it("describes when an item happens", () => {
    expect(describeWhen("2026-10-16", "14:30")).toBe("Fri, Oct 16, 2:30 PM");
    expect(describeWhen("2026-10-16", null)).toBe("Fri, Oct 16");
  });
});
