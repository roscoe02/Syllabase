import Link from "next/link";
import { Suspense } from "react";
import { Agenda } from "@/components/agenda";
import { CrunchStrip } from "@/components/crunch-strip";
import { crunchWeeks, weeklyLoad } from "@/lib/calendar/crunch";
import { getProfile, listCourses, listEvents, listSyllabusStatus } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { courseLabel } from "@/lib/format";
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
  const { supabase } = await getCurrentUser();
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
  const loads = weeklyLoad(upcoming.map((e) => ({ startsAt: new Date(e.startsAt), weightPercent: e.weightPercent, courseId: e.course?.id ?? null })), tz);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const key = addDaysKey(thisWeek, i * 7);
    return loads.find((l) => l.weekStart === key) ?? { weekStart: key, totalWeight: 0, unweightedCount: 0, eventCount: 0 };
  });
  const heavy = new Set(crunchWeeks(weeks).map((w) => w.weekStart));
  const needsInfo = courses.filter((c) => {
    const s = status.get(c.id);
    return s && (s.missing.length > 0 || s.freshness !== "current");
  });

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

      <section aria-labelledby="crunch-h" className="flex flex-col gap-3">
        <div>
          <h2 id="crunch-h" className="font-medium">Your semester by week</h2>
          <p className="text-sm text-ink-muted">Percent of your grades due each week, across all courses. &quot;+2&quot; means two items with no known weight.</p>
        </div>
        <CrunchStrip weeks={weeks} heavy={heavy} currentWeek={thisWeek} />
      </section>

      <section aria-labelledby="courses-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="courses-h" className="font-medium">Courses</h2>
          <Link href="/courses/new" className="btn-quiet">Add a course</Link>
        </div>
        <ul className="divide-y divide-rule border-y border-rule">
          {courses.map((c) => {
            const s = status.get(c.id);
            return (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <Link href={`/courses/${c.id}`} className="num font-medium underline-offset-2 hover:underline">
                  {courseLabel(c)}{c.section ? `.${c.section}` : ""}
                </Link>
                <span className="text-ink-muted">{c.title}</span>
                {s && s.missing.length > 0 && <span className="text-sm">{s.missing.length} missing</span>}
                {s && s.freshness === "outdated" && <span className="text-sm font-medium">Syllabus may be outdated</span>}
              </li>
            );
          })}
        </ul>
        {needsInfo.length > 0 && (
          <p className="text-sm text-ink-muted">Open a course to fill in what its syllabus left out.</p>
        )}
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
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton h-16" />)}
      </div>
    </div>
  );
}
