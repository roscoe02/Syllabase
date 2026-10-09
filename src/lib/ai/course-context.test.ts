import { describe, expect, it } from "vitest";
import { sampleSyllabi } from "@/lib/demo/sample-courses";
import { formatCourseContext } from "./course-context";

describe("formatCourseContext", () => {
  const [cs] = sampleSyllabi("2026-10-08", "Fall 2026");
  const course = { id: "c1", code: "CS 3345", section: "001", title: "Data Structures", term: "Fall 2026", instructor_name: "Dr. A. Example", instructor_email: "a@example.edu" };
  const text = formatCourseContext({
    courses: [course],
    syllabi: new Map([["c1", cs]]),
    events: [
      { course_id: "c1", title: "Midterm 1", kind: "exam", starts_at: "2026-10-14T17:00:00Z", all_day: true, weight_percent: "20", source: "syllabus" },
      { course_id: "c1", title: "Homework 5", kind: "homework", starts_at: "2026-10-10T04:59:00Z", all_day: false, weight_percent: null, source: "ics" },
    ],
    tz: "America/Chicago",
    now: new Date("2026-10-08T15:00:00Z"),
  });

  it("states today's date in the student's time zone", () => {
    expect(text).toContain("Today is Thursday, October 8 (time zone America/Chicago).");
  });
  it("includes grading, policies and what's missing", () => {
    expect(text).toContain("## CS 3345.001 Data Structures (Fall 2026)");
    expect(text).toContain("Grading: Homework 25% (drop lowest 1); Midterms 40%");
    expect(text).toContain("Late work policy: 10% off per day, up to 3 days.");
    expect(text).toContain("Not stated in the syllabus: final exam date");
    expect(text).toContain("Graded items without a date: Final exam (30%)");
  });
  it("lists the calendar with local dates, weights and sources", () => {
    expect(text).toContain("- Wednesday, October 14: Midterm 1 [exam], 20% of course grade (from syllabus)");
    expect(text).toContain("- Friday, October 9, 11:59 PM: Homework 5 [homework] (from Canvas)");
  });
  it("says when there are no courses", () => {
    expect(formatCourseContext({ courses: [], syllabi: new Map(), events: [], tz: "UTC", now: new Date() })).toContain("hasn't added any courses");
  });
});
