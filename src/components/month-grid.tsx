import type { CalendarEvent } from "@/lib/data/queries";
import { courseLabel } from "@/lib/format";
import { addDaysKey, dateKey, mondayOfKey } from "@/lib/time";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month view as a real table (row and column headers for screen readers). `month` is "YYYY-MM". */
export function MonthGrid({ month, events, tz, today }: { month: string; events: CalendarEvent[]; tz: string; today: string }) {
  const first = `${month}-01`;
  const start = mondayOfKey(first);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = dateKey(new Date(e.startsAt), tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  const weeks: string[][] = [];
  for (let d = start; weeks.length < 6; ) {
    const week = Array.from({ length: 7 }, (_, i) => addDaysKey(d, i));
    if (weeks.length >= 4 && week[0].slice(0, 7) !== month) break;
    weeks.push(week);
    d = addDaysKey(d, 7);
  }

  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${first}T12:00:00Z`));

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{label}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((d) => (
            <th key={d} scope="col" className="border-b border-rule py-2 text-left text-xs font-medium text-ink-muted">{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((key) => {
              const inMonth = key.slice(0, 7) === month;
              const dayEvents = byDay.get(key) ?? [];
              return (
                <td key={key} className="h-24 border-b border-rule align-top">
                  <div className={`flex flex-col gap-1 p-1 ${inMonth ? "" : "text-ink-muted"}`}>
                    <span className={`num self-start text-xs ${key === today ? "rounded-sm bg-accent px-1.5 font-medium text-accent-ink" : "text-ink-muted"}`}>
                      {Number(key.slice(8))}
                      {key === today && <span className="sr-only"> (today)</span>}
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <li key={e.id} className="text-xs leading-snug [overflow-wrap:anywhere]" title={`${courseLabel(e.course)} ${e.title}`}>
                          <span className="num text-ink-muted">{courseLabel(e.course)}</span>{" "}
                          <span className={e.kind === "exam" ? "font-medium" : ""}>{e.title}</span>
                        </li>
                      ))}
                      {dayEvents.length > 3 && <li className="text-xs text-ink-muted">+{dayEvents.length - 3} more</li>}
                    </ul>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
