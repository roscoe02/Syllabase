import { notFound } from "next/navigation";
import { Agenda } from "@/components/agenda";
import { CrunchStrip } from "@/components/crunch-strip";
import { MonthGrid } from "@/components/month-grid";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { crunchWeeks, weeklyLoad } from "@/lib/calendar/crunch";
import type { CalendarEvent } from "@/lib/data/queries";
import { addDaysKey } from "@/lib/time";
import { ReviewPreview } from "./review-preview";

/**
 * Development-only gallery of the signed-in UI with sample data, for design checks and screenshots
 * without a Supabase project. Returns 404 in production builds.
 */

const TZ = "America/Chicago";
const TODAY = "2026-10-08";
const CS = { id: "c1", code: "CS 3345" };
const MATH = { id: "c2", code: "MATH 2418" };
const HIST = { id: "c3", code: "HIST 1301" };

const ev = (id: string, date: string, time: string | null, title: string, kind: string, weight: number | null, course: { id: string; code: string }): CalendarEvent => ({
  id,
  title,
  kind,
  startsAt: new Date(`${date}T${time ?? "12:00"}:00-05:00`).toISOString(),
  allDay: !time,
  weightPercent: weight,
  source: "syllabus",
  course,
});

const EVENTS: CalendarEvent[] = [
  ev("1", "2026-10-08", "23:59", "Homework 5", "homework", null, CS),
  ev("2", "2026-10-09", "10:00", "Quiz 3", "quiz", 2, MATH),
  ev("3", "2026-10-14", null, "Midterm 1", "exam", 20, CS),
  ev("4", "2026-10-15", "14:30", "Midterm", "exam", 25, MATH),
  ev("5", "2026-10-16", "23:59", "Primary source essay", "paper", 15, HIST),
  ev("6", "2026-10-21", "23:59", "Homework 6", "homework", null, CS),
  ev("7", "2026-10-28", "23:59", "Reading response 4", "homework", 2.5, HIST),
  ev("8", "2026-11-04", "23:59", "Project milestone 1", "project", 10, CS),
  ev("9", "2026-11-18", null, "Midterm 2", "exam", 20, CS),
  ev("10", "2026-12-08", null, "Final exam", "exam", 35, MATH),
];

const SYLLABUS: ParsedSyllabus = {
  course_code: "CS 3345",
  section: "001",
  course_title: "Data Structures and Introduction to Algorithmic Analysis",
  term: "Spring 2026",
  instructor: { name: "Dr. A. Example", email: "example@utdallas.edu", office: "ECSS 3.401" },
  tas: [],
  meetings: [],
  grading: [
    { name: "Homework", weight_percent: 25, drop_lowest: 1, notes: null },
    { name: "Midterms", weight_percent: 40, drop_lowest: null, notes: null },
    { name: "Final exam", weight_percent: 30, drop_lowest: null, notes: null },
  ],
  grade_scale: [],
  graded_items: [
    { title: "Homework 1", kind: "homework", component: "Homework", due_date: "2026-09-04", due_time: "23:59", weight_percent: null, source_quote: "" },
    { title: "Midterm 1", kind: "exam", component: "Midterms", due_date: "2026-10-14", due_time: null, weight_percent: 20, source_quote: "" },
    { title: "Midterm 2", kind: "exam", component: "Midterms", due_date: "2026-11-18", due_time: null, weight_percent: 20, source_quote: "" },
    { title: "Final exam", kind: "exam", component: "Final exam", due_date: null, due_time: null, weight_percent: 30, source_quote: "" },
  ],
  schedule: [],
  policies: { late_work: "10% off per day, up to 3 days.", attendance: null, ai_usage: "AI tools may be used to study, not to write submitted code.", makeup_exams: null, curve: null },
  required_materials: [],
  missing: ["final exam date", "weight for the remaining 5%"],
};

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const thisWeek = "2026-10-05";
  const loads = weeklyLoad(EVENTS.map((e) => ({ startsAt: new Date(e.startsAt), weightPercent: e.weightPercent, courseId: e.course?.id ?? null })), TZ);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const key = addDaysKey(thisWeek, i * 7);
    return loads.find((l) => l.weekStart === key) ?? { weekStart: key, totalWeight: 0, unweightedCount: 0, eventCount: 0 };
  });
  const heavy = new Set(crunchWeeks(weeks).map((w) => w.weekStart));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-10">
      <section id="dashboard" className="flex flex-col gap-10">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Next two weeks</h2>
          <Agenda events={EVENTS.slice(0, 7)} tz={TZ} today={TODAY} empty={null} />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Your semester by week</h2>
          <CrunchStrip weeks={weeks} heavy={heavy} currentWeek={thisWeek} />
        </div>
      </section>
      <section id="calendar" className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">October 2026</h1>
        <MonthGrid month="2026-10" events={EVENTS} tz={TZ} today={TODAY} />
      </section>
      <section id="review" className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Review</h1>
        <ReviewPreview initial={SYLLABUS} freshness={{ status: "outdated", reason: 'Syllabus says "Spring 2026", but you selected Fall 2026.' }} />
      </section>
    </main>
  );
}
