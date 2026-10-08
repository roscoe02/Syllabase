import { describe, expect, it } from "vitest";
import { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { syllabusToEvents } from "@/lib/syllabus/to-events";
import { dateKey } from "@/lib/time";
import { sampleSyllabi } from "./sample-courses";

describe("sampleSyllabi", () => {
  it("builds valid syllabi dated around today", () => {
    const samples = sampleSyllabi("2027-02-10", "Spring 2027");
    expect(samples).toHaveLength(3);
    for (const s of samples) expect(ParsedSyllabus.safeParse(s).success).toBe(true);
    const dates = samples.flatMap((s) => syllabusToEvents(s, "America/Chicago")).map((e) => dateKey(new Date(e.starts_at), "America/Chicago"));
    expect(dates).toContain("2027-02-11"); // Homework 5, tomorrow
    expect(dates.every((d) => d >= "2027-02-05" && d <= "2027-04-14")).toBe(true);
  });
});
