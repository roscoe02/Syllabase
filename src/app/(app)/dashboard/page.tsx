import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { Agenda } from "@/components/agenda";
import { BigWeeks } from "@/components/big-weeks";
import { bigWeeks } from "@/lib/calendar/big-weeks";
import { syncStaleFeeds } from "@/lib/calendar/sync-feed";
import { getProfile, listCourses, listCurrentGrades, listEvents } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { courseLabel, formatDay, formatKeyShort, formatWeight } from "@/lib/format";
import { addDaysKey, dateKey, mondayOfKey } from "@/lib/time";

export const metadata = { title: "Dashboard · Syllabase" };

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-10">
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

  const [courses, grades, upcoming] = await Promise.all([
    listCourses(supabase),
    listCurrentGrades(supabase),
    listEvents(supabase, new Date(`${thisWeek}T00:00:00Z`).toISOString(), new Date(`${horizonEnd}T00:00:00Z`).toISOString()),
  ]);

  if (courses.length === 0 && upcoming.length === 0) {
    return (
      <section className="flex max-w-xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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

  const soon = nextTwoWeeks.filter((e) => dateKey(new Date(e.startsAt), tz) <= addDaysKey(today, 3)).length;
  const nextExam = upcoming.find((e) => e.kind === "exam" && (e.allDay ? dateKey(new Date(e.startsAt), tz) >= today : e.startsAt >= now.toISOString()));
  const busiest = [...weeksAhead].sort((a, b) => b.totalWeight - a.totalWeight)[0];
  const biggest = busiest && [...busiest.weighted].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0))[0];
  const todayLong = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(now);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {soon === 0 ? "Nothing due in the next 3 days" : `${soon} ${soon === 1 ? "thing" : "things"} due in the next 3 days`}
          </h1>
          <p className="text-ink-muted">
            {todayLong}.
            {nextExam &&
              ` Your next exam is ${nextExam.title}${nextExam.course ? ` for ${courseLabel(nextExam.course)}` : ""} on ${formatDay(nextExam.startsAt, tz)}.`}
          </p>
        </header>

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
      </div>

      <aside className="flex flex-col gap-8" aria-label="Summary">
        {busiest && (
          <div className="rounded-lg bg-accent-soft p-4">
            <p className="text-sm font-medium text-accent">Busiest week ahead</p>
            <p className="mt-1 text-xl font-semibold">
              {formatKeyShort(busiest.weekStart)} to {formatKeyShort(addDaysKey(busiest.weekStart, 6))}
            </p>
            <p className="mt-1 text-sm">
              {busiest.weighted.length} graded {busiest.weighted.length === 1 ? "item" : "items"}
              {biggest && `, including ${biggest.course ? `${courseLabel(biggest.course)} ` : ""}${biggest.title} (${formatWeight(biggest.weightPercent)})`}.
            </p>
          </div>
        )}

        <section aria-labelledby="grades-h" className="flex flex-col gap-2">
          <h2 id="grades-h" className="font-medium">Your grades</h2>
          <ul className="border-t border-rule">
            {courses.map((c) => {
              const g = grades.get(c.id);
              return (
                <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
                  <Link href={`/courses/${c.id}`} className="num text-sm underline-offset-2 hover:underline">
                    {courseLabel(c)}
                  </Link>
                  {g == null ? <span className="text-sm text-ink-muted">No scores yet</span> : <span className="num">{Math.round(g * 10) / 10}%</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col gap-2">
          <Link href="/chat?mode=calendar" className="btn-primary justify-start">Tell Syllabase what changed</Link>
          <Link href="/courses" className="btn-quiet self-start px-0">All courses</Link>
        </div>
      </aside>
    </div>
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
