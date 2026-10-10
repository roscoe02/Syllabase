import Link from "next/link";
import { Suspense } from "react";
import { Agenda } from "@/components/agenda";
import { MonthGrid } from "@/components/month-grid";
import { getProfile, listEvents } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { addDaysKey, dateKey, mondayOfKey } from "@/lib/time";

export const metadata = { title: "Calendar · Syllabase" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <main id="main" className="flex flex-col gap-6">
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const { supabase } = await getCurrentUser();
  const { timezone: tz } = await getProfile(supabase);
  const today = dateKey(new Date(), tz);
  const param = (await searchParams).month;
  const month = typeof param === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : today.slice(0, 7);

  // Fetch the visible 6-week window with a day of slack on each side for time zones.
  const from = addDaysKey(mondayOfKey(`${month}-01`), -1);
  const to = addDaysKey(from, 44);
  const events = await listEvents(supabase, new Date(`${from}T00:00:00Z`).toISOString(), new Date(`${to}T00:00:00Z`).toISOString());
  const monthEvents = events.filter((e) => dateKey(new Date(e.startsAt), tz).startsWith(month));
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="mr-auto text-2xl font-semibold">{label}</h1>
        <nav aria-label="Months" className="flex items-center gap-2">
          <Link href={`/calendar?month=${shiftMonth(month, -1)}`} className="btn-secondary px-3 py-1">Previous</Link>
          <Link href="/calendar" className="btn-quiet">Today</Link>
          <Link href={`/calendar?month=${shiftMonth(month, 1)}`} className="btn-secondary px-3 py-1">Next</Link>
        </nav>
        <Link href="/chat?mode=calendar" className="btn-quiet px-0">Tell Syllabase what changed</Link>
        <Link href="/settings#canvas" className="btn-quiet px-0">Import from Canvas</Link>
        <Link href="/settings#calendar-export" className="btn-quiet px-0">Add to Google or Apple Calendar</Link>
      </header>
      <div className="hidden md:block">
        <MonthGrid month={month} events={events} tz={tz} today={today} />
      </div>
      <section aria-labelledby="list-h" className="flex flex-col gap-3">
        <h2 id="list-h" className="font-medium md:sr-only">Everything this month</h2>
        <Agenda events={monthEvents} tz={tz} today={today} empty={<p className="text-ink-muted">Nothing on the calendar this month.</p>} />
      </section>
    </>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading calendar">
      <div className="skeleton h-8 w-48" />
      <div className="hidden grid-cols-7 gap-px md:grid">
        {Array.from({ length: 35 }, (_, i) => <div key={i} className="skeleton h-24 rounded-none" />)}
      </div>
    </div>
  );
}
