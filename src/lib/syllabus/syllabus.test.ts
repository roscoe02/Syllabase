import { describe, expect, it } from "vitest";
import { dropInvalidDates, type ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { checkFreshness } from "./staleness";
import { termWindow, upcomingTerms } from "./terms";
import { syllabusToEvents } from "./to-events";

const base: ParsedSyllabus = {
  course_code: "CS 3345",
  section: "001",
  course_title: "Data Structures",
  term: "Fall 2026",
  instructor: { name: "Dr. Example", email: null, office: null },
  tas: [],
  meetings: [],
  grading: [
    { name: "Homework", weight_percent: 30, drop_lowest: 1, notes: null },
    { name: "Midterm", weight_percent: 30, drop_lowest: null, notes: null },
    { name: "Final", weight_percent: 40, drop_lowest: null, notes: null },
  ],
  grade_scale: [],
  graded_items: [
    { title: "HW 1", kind: "homework", component: "Homework", due_date: "2026-09-04", due_time: "23:59", weight_percent: null, source_quote: "" },
    { title: "HW 2", kind: "homework", component: "Homework", due_date: "2026-09-11", due_time: "23:59", weight_percent: null, source_quote: "" },
    { title: "Midterm", kind: "exam", component: "Midterm", due_date: "2026-10-14", due_time: null, weight_percent: null, source_quote: "" },
    { title: "Final", kind: "exam", component: "Final", due_date: null, due_time: null, weight_percent: null, source_quote: "" },
  ],
  schedule: [],
  policies: { late_work: null, attendance: null, ai_usage: null, makeup_exams: null, curve: null },
  required_materials: [],
  missing: ["final exam date"],
};

describe("syllabusToEvents", () => {
  const rows = syllabusToEvents(base, "America/Chicago");

  it("skips items without a date", () => {
    expect(rows.map((r) => r.title)).toEqual(["HW 1", "HW 2", "Midterm"]);
  });
  it("keeps timed items timed and all-day items all-day", () => {
    expect(rows[0]).toMatchObject({ all_day: false, starts_at: "2026-09-05T04:59:00.000Z", kind: "homework" });
    expect(rows[2]).toMatchObject({ all_day: true, kind: "exam" });
  });
  it("inherits weight only from a single-item component, never splits", () => {
    expect(rows[2].weight_percent).toBe(30); // sole item in Midterm
    expect(rows[0].weight_percent).toBeNull(); // Homework has 2 items: no invented split
  });
  it("produces stable, unique keys", () => {
    const dup = { ...base, graded_items: [base.graded_items[0], { ...base.graded_items[0] }] };
    const keys = syllabusToEvents(dup, "America/Chicago").map((r) => r.source_uid);
    expect(keys).toEqual(["2026-09-04:hw-1", "2026-09-04:hw-1:2"]);
    expect(syllabusToEvents(base, "America/Chicago").map((r) => r.source_uid)).toEqual(rows.map((r) => r.source_uid));
  });
});

describe("terms", () => {
  it("lists the current term and the next two", () => {
    expect(upcomingTerms(new Date("2026-10-08")).map((t) => t.name)).toEqual(["Fall 2026", "Spring 2027", "Summer 2027"]);
    expect(upcomingTerms(new Date("2027-03-01")).map((t) => t.name)).toEqual(["Spring 2027", "Summer 2027", "Fall 2027"]);
  });
  it("flags last semester's syllabus as outdated", () => {
    expect(checkFreshness({ ...base, term: "Spring 2026" }, termWindow("Fall", 2026)).status).toBe("outdated");
    expect(checkFreshness(base, termWindow("Fall", 2026)).status).toBe("current");
  });
});

describe("dropInvalidDates", () => {
  it("turns unreadable dates and times into missing values instead of crashing", () => {
    const messy = dropInvalidDates({
      ...base,
      graded_items: [
        { ...base.graded_items[0], due_date: "TBD", due_time: "11:59 PM" },
        { ...base.graded_items[0], due_date: "2026-02-31", due_time: "23:59" },
        { ...base.graded_items[0], due_date: "2026-10-14", due_time: "23:59" },
      ],
    });
    expect(messy.graded_items.map((i) => [i.due_date, i.due_time])).toEqual([[null, null], [null, "23:59"], ["2026-10-14", "23:59"]]);
    expect(() => syllabusToEvents(messy, "America/Chicago")).not.toThrow();
  });
});
