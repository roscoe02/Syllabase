import { describe, expect, it } from "vitest";
import { byProfessor, courseParts, parseGradeCsv, samePerson, splitName, sumGrades } from "./utd-grade-data";

const CSV = [
  "Subject,Catalog Nbr,Section,A+,A,A-,B+,B,B-,C+,C,C-,D+,D,D-,F,CR,I,NC,W,P,Instructor 1,Instructor 2,Instructor 3,Instructor 4,Instructor 5,Instructor 6,instructor_id,instructor_name_normalized,title",
  'CS,3345,001,1,10,5,,3,,,2,,,,,1,,,,2,,"Smith, Jane Q",,,,,,abc,jane smith,Data Structures',
  'CS,3345,002,,4,4,4,,,,,,,,,,,,,,,"Lee, Kim","Smith, John",,,,,def,kim lee,Data Structures',
  'CS,3341,001,9,9,9,,,,,,,,,,,,,,,,"Smith, Jane",,,,,,abc,jane smith,Probability',
].join("\n");

describe("UTD grade data", () => {
  const rows = parseGradeCsv(CSV, "CS", "3345");

  it("reads one course's sections, with quoted instructor names", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].counts).toEqual([1, 10, 5, 0, 3, 0, 0, 2, 0, 0, 0, 0, 1, 2]);
    expect(rows[1].instructors).toEqual(["Lee, Kim", "Smith, John"]);
    expect(rows[0].title).toBe("Data Structures");
  });

  it("sums sections and filters by professor", () => {
    expect(sumGrades(rows)).toMatchObject({ students: 36, sections: 2 });
    expect(byProfessor(rows, "Dr. Jane Smith, Ph.D.")).toHaveLength(1); // not John Smith's section
    expect(byProfessor(rows, "Dr. A. Example")).toHaveLength(0);
  });

  it("normalizes names and course codes", () => {
    expect(splitName("Smith, Jane Q")).toEqual({ first: "jane", last: "smith" });
    expect(splitName("Prof. Jane Smith")).toEqual({ first: "jane", last: "smith" });
    expect(samePerson({ first: "j", last: "smith" }, { first: "jane", last: "smith" })).toBe(true);
    expect(samePerson({ first: "john", last: "smith" }, { first: "jane", last: "smith" })).toBe(false);
    expect(courseParts("CS 3345")).toEqual({ subject: "CS", number: "3345" });
    expect(courseParts("cs3345.001")).toEqual({ subject: "CS", number: "3345" });
    expect(courseParts("Biology")).toBeNull();
  });
});
