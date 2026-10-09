import Link from "next/link";
import { Agenda } from "@/components/agenda";
import { GuestButton } from "@/components/guest-button";
import type { CalendarEvent } from "@/lib/data/queries";
import { sampleSyllabi } from "@/lib/demo/sample-courses";
import { syllabusToEvents } from "@/lib/syllabus/to-events";

// The sample is pinned to one week so the page stays static; guests get the same courses dated from today.
const TODAY = "2026-10-08";
const TZ = "America/Chicago";
const SAMPLE = sampleSyllabi(TODAY, "Fall 2026");
const UNTIL = "2026-10-23";
const EVENTS: CalendarEvent[] = SAMPLE.flatMap((s) =>
  syllabusToEvents(s, TZ).map((e) => ({
    id: `${s.course_code}-${e.source_uid}`,
    title: e.title,
    kind: e.kind,
    startsAt: e.starts_at,
    allDay: e.all_day,
    weightPercent: e.weight_percent,
    source: "syllabus" as const,
    course: { id: s.course_code ?? "", code: s.course_code },
  })),
)
  .filter((e) => e.startsAt >= TODAY && e.startsAt < UNTIL)
  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

const EXCERPT: [string, string][] = [
  ["Homework (lowest dropped)", "25%"],
  ["Midterm 1 and 2", "40%"],
  ["Final exam", "30%"],
  ["Participation", "5%"],
];
const SCHEDULE: [string, string][] = [
  ["Oct 9", "Homework 5 due 11:59 PM"],
  ["Oct 14", "Midterm 1 (20%)"],
  ["Oct 21", "Homework 6 due 11:59 PM"],
  ["Nov 11", "Midterm 2 (20%)"],
  ["Finals week", "Final exam, date TBA"],
];

const FEATURES = [
  ["Syllabus to calendar", "Upload each syllabus once. Exams, due dates, grade weights and policies land in one calendar."],
  ["Canvas calendar sync", "Paste your Canvas calendar link. New assignments show up on their own, without duplicating the syllabus."],
  ["Ask about your classes", "Chat with an assistant that knows your syllabi and calendar, or switch to a study mode like a Feynman check."],
  ["Study tools", "Cheat sheets, quizzes, flashcards and an exam predictor, built from your own notes and past exams."],
  ["Grade calculator", "Enter scores as you get them back and see what you need on the rest for an A, B or C."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-16 sm:py-24">
      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-4xl font-semibold">Syllabase</h1>
        <p className="text-lg text-ink-muted">
          Your syllabi, deadlines and course materials in one place, with a study assistant that knows your classes.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* Known limit: no CAPTCHA token here. If Turnstile is turned on in Supabase, guests must start from /login. */}
          <GuestButton />
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
        </div>
        <p className="text-sm text-ink-muted">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </header>

      <section aria-labelledby="sample-h" className="flex flex-col gap-6">
        <h2 id="sample-h" className="text-xl font-semibold">Three syllabi, one calendar</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <figure className="flex flex-col gap-4 self-start rounded-md border border-rule p-4">
            <figcaption className="text-sm text-ink-muted">A sample CS 3345 syllabus</figcaption>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">Grading</p>
              <dl className="flex flex-col gap-1">
                {EXCERPT.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-dotted border-rule">
                    <dt>{k}</dt>
                    <dd className="num">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">Schedule</p>
              <dl className="flex flex-col gap-1">
                {SCHEDULE.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[6rem_1fr] gap-2">
                    <dt className="num text-ink-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="text-sm">Late work: 10% off per day, up to 3 days.</p>
          </figure>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">What Syllabase shows, next to your other classes</p>
            {/* No "due soon" highlight: the sample week is fixed, so it would mark old dates as soon. */}
            <Agenda events={EVENTS} tz={TZ} today={TODAY} soonDays={0} linkCourses={false} empty={null} />
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium">Not in the syllabus</p>
              <ul className="flex flex-wrap gap-2">
                {SAMPLE[0].missing.map((m) => (
                  <li key={m} className="rounded-sm border border-dashed border-ink-muted px-2 py-1">{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <dl className="max-w-3xl divide-y divide-rule border-y border-rule">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="font-medium">{title}</dt>
            <dd className="text-ink-muted">{body}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
