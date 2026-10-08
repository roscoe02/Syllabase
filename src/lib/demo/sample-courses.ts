import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { addDaysKey } from "@/lib/time";

/**
 * Three sample courses for guest accounts, so the dashboard and calendar show something real right away.
 * Every date is an offset from `today` (YYYY-MM-DD), so the demo never looks stale.
 */

type Item = ParsedSyllabus["graded_items"][number];

const item = (
  today: string,
  title: string,
  kind: Item["kind"],
  component: string,
  offsetDays: number | null,
  time: string | null,
  weight: number | null = null,
): Item => ({
  title,
  kind,
  component,
  due_date: offsetDays == null ? null : addDaysKey(today, offsetDays),
  due_time: time,
  weight_percent: weight,
  source_quote: "Sample course",
});

const course = (fields: Partial<ParsedSyllabus>): ParsedSyllabus => ({
  course_code: null,
  section: null,
  course_title: null,
  term: null,
  instructor: { name: null, email: null, office: null },
  tas: [],
  meetings: [],
  grading: [],
  grade_scale: [],
  graded_items: [],
  schedule: [],
  policies: { late_work: null, attendance: null, ai_usage: null, makeup_exams: null, curve: null },
  required_materials: [],
  missing: [],
  ...fields,
});

export function sampleSyllabi(today: string, termName: string): ParsedSyllabus[] {
  const d = (title: string, kind: Item["kind"], component: string, offset: number | null, time: string | null, weight?: number) =>
    item(today, title, kind, component, offset, time, weight ?? null);

  return [
    course({
      course_code: "CS 3345",
      section: "001",
      course_title: "Data Structures and Introduction to Algorithmic Analysis",
      term: termName,
      instructor: { name: "Dr. A. Example", email: "a.example@example.edu", office: "ECSS 3.401" },
      grading: [
        { name: "Homework", weight_percent: 25, drop_lowest: 1, notes: null },
        { name: "Midterms", weight_percent: 40, drop_lowest: null, notes: null },
        { name: "Final exam", weight_percent: 30, drop_lowest: null, notes: null },
        { name: "Participation", weight_percent: 5, drop_lowest: null, notes: null },
      ],
      graded_items: [
        d("Homework 4", "homework", "Homework", -5, "23:59"),
        d("Homework 5", "homework", "Homework", 1, "23:59"),
        d("Midterm 1", "exam", "Midterms", 6, null, 20),
        d("Homework 6", "homework", "Homework", 13, "23:59"),
        d("Midterm 2", "exam", "Midterms", 34, null, 20),
        d("Final exam", "exam", "Final exam", null, null, 30),
      ],
      policies: {
        late_work: "10% off per day, up to 3 days.",
        attendance: null,
        ai_usage: "AI tools may be used to study, not to write submitted code.",
        makeup_exams: "Only with documentation, arranged before the exam.",
        curve: null,
      },
      missing: ["final exam date", "homework due times after week 8"],
    }),
    course({
      course_code: "MATH 2418",
      section: "002",
      course_title: "Linear Algebra",
      term: termName,
      instructor: { name: "Dr. B. Sample", email: "b.sample@example.edu", office: "FO 2.604" },
      grading: [
        { name: "Homework", weight_percent: 30, drop_lowest: 2, notes: null },
        { name: "Quizzes", weight_percent: 10, drop_lowest: null, notes: null },
        { name: "Midterm", weight_percent: 25, drop_lowest: null, notes: null },
        { name: "Final exam", weight_percent: 35, drop_lowest: null, notes: null },
      ],
      graded_items: [
        d("Quiz 3", "quiz", "Quizzes", 2, "10:00"),
        d("Midterm", "exam", "Midterm", 7, "14:30"),
        d("Quiz 4", "quiz", "Quizzes", 16, "10:00"),
        d("Final exam", "exam", "Final exam", 62, "11:00"),
      ],
      missing: ["homework due dates", "number of quizzes"],
    }),
    course({
      course_code: "HIST 1301",
      section: "004",
      course_title: "U.S. History Survey",
      term: termName,
      instructor: { name: "Dr. C. Placeholder", email: null, office: null },
      grading: [
        { name: "Reading responses", weight_percent: 20, drop_lowest: 1, notes: null },
        { name: "Primary source essay", weight_percent: 15, drop_lowest: null, notes: null },
        { name: "Midterm", weight_percent: 25, drop_lowest: null, notes: null },
        { name: "Final exam", weight_percent: 40, drop_lowest: null, notes: null },
      ],
      graded_items: [
        d("Reading response 3", "homework", "Reading responses", 3, "23:59"),
        d("Primary source essay", "paper", "Primary source essay", 8, "23:59"),
        d("Reading response 4", "homework", "Reading responses", 17, "23:59"),
        d("Midterm", "exam", "Midterm", 24, null),
        d("Final exam", "exam", "Final exam", null, null),
      ],
      policies: { late_work: "Not accepted after the answer key is posted.", attendance: "Three free absences.", ai_usage: null, makeup_exams: null, curve: null },
      missing: ["instructor email", "final exam date", "policy on AI tools"],
    }),
  ];
}
