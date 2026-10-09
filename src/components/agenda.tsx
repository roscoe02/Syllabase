import Link from "next/link";
import type { CalendarEvent } from "@/lib/data/queries";
import { courseLabel, formatKeyDay, formatTime, formatWeight } from "@/lib/format";
import { dateKey } from "@/lib/time";

/** Upcoming items, one row each. Dates within `soonDays` of today are marked in the accent color. */
export function Agenda({
  events,
  tz,
  today,
  soonDays = 3,
  empty,
  linkCourses = true,
}: {
  events: CalendarEvent[];
  tz: string;
  today: string;
  soonDays?: number;
  empty: React.ReactNode;
  /** Off for sample data, whose courses have no page. */
  linkCourses?: boolean;
}) {
  if (events.length === 0) return <>{empty}</>;

  const days = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = dateKey(new Date(e.startsAt), tz);
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  const soonLimit = new Date(`${today}T00:00:00Z`);
  soonLimit.setUTCDate(soonLimit.getUTCDate() + soonDays);
  const soonKey = soonLimit.toISOString().slice(0, 10);

  return (
    <ol className="border-t border-rule">
      {[...days].flatMap(([key, dayEvents]) => {
        const soon = key >= today && key <= soonKey;
        const day = key === today ? "Today" : formatKeyDay(key);
        return dayEvents.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-rule py-2.5 sm:grid sm:grid-cols-[6.5rem_4.5rem_5.5rem_minmax(0,1fr)_auto] sm:gap-x-4"
          >
            {/* Phones: the title leads its row; wider screens keep the columns aligned. */}
            <span className={`order-first basis-full sm:order-none sm:col-start-4 sm:row-start-1 ${e.kind === "exam" ? "font-semibold" : ""}`}>{e.title}</span>
            <span className={`num text-sm sm:col-start-1 sm:row-start-1 ${soon ? "font-medium text-accent" : ""}`}>
              {day}
              {soon && key !== today && <span className="sr-only"> (due soon)</span>}
            </span>
            <span className="num whitespace-nowrap text-sm text-ink-muted sm:col-start-2 sm:row-start-1">{e.allDay ? "All day" : formatTime(e.startsAt, tz)}</span>
            {e.course && linkCourses ? (
              <Link href={`/courses/${e.course.id}`} className="num text-sm underline-offset-2 hover:underline sm:col-start-3 sm:row-start-1">
                {courseLabel(e.course)}
              </Link>
            ) : (
              <span className="num text-sm text-ink-muted sm:col-start-3 sm:row-start-1">{courseLabel(e.course)}</span>
            )}
            <span className="num text-sm text-ink-muted sm:col-start-5 sm:row-start-1">{formatWeight(e.weightPercent)}</span>
          </li>
        ));
      })}
    </ol>
  );
}
