import Link from "next/link";
import type { CalendarEvent } from "@/lib/data/queries";
import { courseLabel, formatKeyLong, formatTime, formatWeight } from "@/lib/format";
import { dateKey } from "@/lib/time";

/** Events grouped by day. Days within `soonDays` of today get the highlighter. */
export function Agenda({
  events,
  tz,
  today,
  soonDays = 3,
  empty,
}: {
  events: CalendarEvent[];
  tz: string;
  today: string;
  soonDays?: number;
  empty: React.ReactNode;
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
    <ol className="flex flex-col divide-y divide-rule border-y border-rule">
      {[...days].map(([key, dayEvents]) => {
        const soon = key <= soonKey;
        return (
          <li key={key} className="grid gap-2 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <h3 className="text-sm font-medium">
              <span className={soon ? "bg-highlight px-1" : ""}>{key === today ? "Today" : formatKeyLong(key)}</span>
              {soon && key !== today && <span className="sr-only"> (due soon)</span>}
            </h3>
            <ul className="flex flex-col gap-2">
              {dayEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num w-20 shrink-0 whitespace-nowrap text-sm text-ink-muted">{e.allDay ? "All day" : formatTime(e.startsAt, tz)}</span>
                  {e.course ? (
                    <Link href={`/courses/${e.course.id}`} className="num text-sm underline-offset-2 hover:underline">
                      {courseLabel(e.course)}
                    </Link>
                  ) : (
                    <span className="num text-sm text-ink-muted">Other</span>
                  )}
                  <span className={e.kind === "exam" ? "font-medium" : ""}>{e.title}</span>
                  {formatWeight(e.weightPercent) && <span className="num text-sm text-ink-muted">{formatWeight(e.weightPercent)}</span>}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
