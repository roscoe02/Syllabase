import Link from "next/link";
import { Suspense } from "react";
import { CourseList } from "@/components/course-list";
import { getProfile, listCourses, listEvents, listSyllabusStatus, type CalendarEvent } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { dateKey } from "@/lib/time";

export const metadata = { title: "Courses · Syllabase" };

const DAY = 24 * 60 * 60 * 1000;

export default function CoursesPage() {
  return (
    <main id="main" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <Link href="/courses/new" className="btn-primary">Add a course</Link>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading courses">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-16 w-full" />)}
          </div>
        }
      >
        <Courses />
      </Suspense>
    </main>
  );
}

async function Courses() {
  const { supabase } = await getCurrentUser();
  const now = new Date();
  const [{ timezone: tz }, courses, status, events] = await Promise.all([
    getProfile(supabase),
    listCourses(supabase),
    listSyllabusStatus(supabase),
    listEvents(supabase, new Date(now.getTime() - DAY).toISOString(), new Date(now.getTime() + 120 * DAY).toISOString()),
  ]);
  if (courses.length === 0) {
    return <p className="text-ink-muted">No courses yet. Upload a syllabus, or connect your Canvas calendar in Settings.</p>;
  }

  // Like the dashboard: an all-day item due today still counts as next.
  const today = dateKey(now, tz);
  const next = new Map<string, CalendarEvent>();
  for (const e of events) {
    const upcoming = e.allDay ? dateKey(new Date(e.startsAt), tz) >= today : e.startsAt >= now.toISOString();
    if (e.course && upcoming && !next.has(e.course.id)) next.set(e.course.id, e);
  }
  return <CourseList courses={courses} status={status} next={next} tz={tz} />;
}
