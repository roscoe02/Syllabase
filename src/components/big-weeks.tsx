import Link from "next/link";
import type { BigWeek } from "@/lib/calendar/big-weeks";
import type { CalendarEvent } from "@/lib/data/queries";
import { courseLabel, formatDay, formatKeyShort, formatWeight } from "@/lib/format";
import { addDaysKey } from "@/lib/time";

/** The weeks with the most graded work due, each with the items that make it heavy. */
export function BigWeeks({ weeks, tz, thisWeek }: { weeks: BigWeek<CalendarEvent>[]; tz: string; thisWeek: string }) {
  if (weeks.length === 0) {
    return <p className="text-ink-muted">No big weeks coming up. Weeks with exams or major assignments show up here.</p>;
  }

  const label = (start: string) =>
    start === thisWeek ? "This week" : start === addDaysKey(thisWeek, 7) ? "Next week" : `Week of ${formatKeyShort(start)}`;

  return (
    <ol className="flex flex-col divide-y divide-rule border-y border-rule">
      {weeks.map((w) => (
        <li key={w.weekStart} className="grid gap-2 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
          <div className="flex flex-col">
            <h3 className="text-sm font-medium">
              <span className={w.weekStart === thisWeek ? "text-accent" : ""}>{label(w.weekStart)}</span>
            </h3>
            <p className="text-sm text-ink-muted">
              {w.weighted.length} graded {w.weighted.length === 1 ? "item" : "items"}
              {w.otherCount > 0 && `, ${w.otherCount} more due`}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {w.weighted.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="num w-24 shrink-0 whitespace-nowrap text-sm text-ink-muted">{formatDay(e.startsAt, tz)}</span>
                {e.course ? (
                  <Link href={`/courses/${e.course.id}`} className="num text-sm underline-offset-2 hover:underline">
                    {courseLabel(e.course)}
                  </Link>
                ) : (
                  <span className="num text-sm text-ink-muted">Other</span>
                )}
                <span className={e.kind === "exam" ? "font-medium" : ""}>{e.title}</span>
                <span className="num text-sm text-ink-muted">{formatWeight(e.weightPercent)} of course grade</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
