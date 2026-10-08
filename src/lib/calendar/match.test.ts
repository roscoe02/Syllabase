import { describe, expect, it } from "vitest";
import { findSyllabusItem, matchCourse, matchCourseForSyllabus, parseCourseCode, sameItem, stripCoursePrefix, termFromCode } from "./match";

describe("parseCourseCode", () => {
  it("reads the formats Canvas uses", () => {
    expect(parseCourseCode("CE-4337.007-CS-4337.007 - F26")).toMatchObject({ key: "4337.007", subjects: ["CE", "CS"] });
    expect(parseCourseCode("CS 4392.001 - F26")).toMatchObject({ key: "4392.001", subjects: ["CS"] });
    expect(parseCourseCode("CS 4485.0W1 - F26")).toMatchObject({ key: "4485.0W1", section: "0W1" });
    expect(parseCourseCode("CS-4348.503-SE-4348.503 - F26")?.key).toBe("4348.503");
    expect(parseCourseCode("Office hours")).toBeNull();
  });
});

describe("matchCourse", () => {
  const courses = [
    { id: "a", code: "CS/CE 4337", section: "007", canvas_key: null },
    { id: "b", code: "CS 4348", section: null, canvas_key: null },
    { id: "c", code: "CS 4349", section: "002", canvas_key: null },
    { id: "d", code: "CS 4392", section: "001", canvas_key: "4392.001" },
  ];
  it("matches by number and section, or a stored key", () => {
    expect(matchCourse(courses, parseCourseCode("CE-4337.007-CS-4337.007 - F26")!)?.id).toBe("a");
    expect(matchCourse(courses, parseCourseCode("CS-4348.503-SE-4348.503 - F26")!)?.id).toBe("b"); // section unknown
    expect(matchCourse(courses, parseCourseCode("CS 4349.004 - F26")!)).toBeNull(); // different section
    expect(matchCourse(courses, parseCourseCode("CS 4392.001 - F26")!)?.id).toBe("d");
  });
  it("finds the course a syllabus belongs to", () => {
    expect(matchCourseForSyllabus(courses, "CS 4392", "001")?.id).toBe("d");
    expect(matchCourseForSyllabus(courses, "MATH 2418", "001")).toBeNull();
  });
});

describe("sameItem", () => {
  it("matches the same assignment or exam", () => {
    expect(sameItem("CS 4337- Assignment 1", "Assignment 1")).toBe(true);
    expect(sameItem("Assignment_1", "Assignment 1")).toBe(true);
    expect(sameItem("Homework1", "Homework 1")).toBe(true);
    expect(sameItem("HW 3", "Homework 3")).toBe(true);
    expect(sameItem("Midterm", "Midterm Exam")).toBe(true);
    expect(sameItem("Final Exam", "Final")).toBe(true);
  });
  it("keeps different items apart", () => {
    expect(sameItem("Assignment 1", "Assignment 2")).toBe(false);
    expect(sameItem("CS 4337- Quiz 3", "Quizzes")).toBe(false);
    expect(sameItem("Attendance Quiz 4", "Quiz 4")).toBe(true); // same number and word: close enough
    expect(sameItem("Midterm", "Final Exam")).toBe(false);
    expect(sameItem("Midterm Peer Evaluation (individual, confidential)", "Midterm")).toBe(false);
  });
  it("ignores section notes in parentheses", () => {
    expect(sameItem("Assignment 1  (59.- UTDallas - CS Project - Prof. Example - T3)", "Assignment 1")).toBe(true);
  });
});

describe("findSyllabusItem", () => {
  const items = [
    { title: "Midterm Exam", date: "2026-10-28", weightPercent: 20, eventId: "e1" },
    { title: "Assignment 1", date: null, weightPercent: 10, eventId: null },
    { title: "Assignment 2", date: null, weightPercent: 10, eventId: null },
  ];
  it("pairs a feed item with its syllabus item", () => {
    expect(findSyllabusItem("Midterm", "2026-10-29", items)?.eventId).toBe("e1");
    expect(findSyllabusItem("CS 4337- Assignment 1", "2026-09-20", items)?.weightPercent).toBe(10);
  });
  it("ignores dated items that are far apart", () => {
    expect(findSyllabusItem("Midterm", "2026-12-09", items)).toBeNull();
  });
});

describe("titles and terms", () => {
  it("strips the course prefix and reads the term", () => {
    expect(stripCoursePrefix("CS 4337- Quiz 3")).toBe("Quiz 3");
    expect(stripCoursePrefix("Quiz 03")).toBe("Quiz 03");
    expect(termFromCode("CS 4392.001 - F26")).toBe("Fall 2026");
  });
});
