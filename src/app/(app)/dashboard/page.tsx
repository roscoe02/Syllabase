import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { Agenda } from "@/components/agenda";
import { BigWeeks } from "@/components/big-weeks";
import { CourseList } from "@/components/course-list";
import { bigWeeks } from "@/lib/calendar/big-weeks";
import { syncStaleFeeds } from "@/lib/calendar/sync-feed";
import { getProfile, listCourses, listEvents, listSyllabusStatus } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysKey, dateKey, mondayOfKey } from "@/lib/time";

export const metadata = { title: "Dashboard · Syllabase" };

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const { supabase, id } = await getCurrentUser();
  // Canvas items show up on the next visit without slowing this one down.
  after(() => syncStaleFeeds(createAdminClient(), id));
  const { timezone: tz } = await getProfile(supabase);
  const now = new Date();
  const today = dateKey(now, tz);
  const thisWeek = mondayOfKey(today);
  const horizonEnd = addDaysKey(thisWeek, 7 * 12);

  const [courses, status, upcoming] = await Promise.all([
    listCourses(supabase),
    listSyllabusStatus(supabase),
    listEvents(supabase, new Date(`${thisWeek}T00:00:00Z`).toISOString(), new Date(`${horizonEnd}T00:00:00Z`).toISOString()),
  ]);

  if (courses.length === 0 && upcoming.length === 0) {
    return (
      <section className="flex max-w-xl flex-col gap-4">
        <p>Nothing here yet. Add your first course to see deadlines, grade weights and your busiest weeks.</p>
        <div>
          <Link href="/courses/new" className="btn-primary">Upload a syllabus</Link>
        </div>
      </section>
    );
  }

  // Compare by local date, not instant: an all-day item due today stays listed all day.
  const nextTwoWeeks = upcoming.filter((e) => {
    const key = dateKey(new Date(e.startsAt), tz);
    return key >= today && key < addDaysKey(today, 14) && (e.allDay || e.startsAt >= now.toISOString());
  });
  const weeksAhead = bigWeeks(upcoming.filter((e) => dateKey(new Date(e.startsAt), tz) >= today), tz);

  return (
    <>
      <section aria-labelledby="next-h" className="flex flex-col gap-3">
        <h2 id="next-h" className="font-medium">Next two weeks</h2>
        <Agenda
          events={nextTwoWeeks}
          tz={tz}
          today={today}
          empty={<p className="text-ink-muted">Nothing due in the next two weeks.</p>}
        />
      </section>

      <section aria-labelledby="big-h" className="flex flex-col gap-3">
        <div>
          <h2 id="big-h" className="font-medium">Big weeks ahead</h2>
          <p className="text-sm text-ink-muted">The weeks with the most graded work due in the next three months.</p>
        </div>
        <BigWeeks weeks={weeksAhead} tz={tz} thisWeek={thisWeek} />
      </section>

      <section aria-labelledby="courses-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="courses-h" className="font-medium">Courses</h2>
          <Link href="/courses" className="btn-quiet">All courses</Link>
        </div>
        <CourseList courses={courses} status={status} tz={tz} />
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-5 w-40" />
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-10 w-full" />)}
      </div>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-5 w-40" />
        {Array.from({ length: 2 }, (_, i) => <div key={i} className="skeleton h-16 w-full" />)}
      </div>
    </div>
  );
}
