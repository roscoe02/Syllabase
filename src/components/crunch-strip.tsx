import type { WeekLoad } from "@/lib/calendar/crunch";
import { formatKeyShort } from "@/lib/format";

/**
 * One cell per week, darker = more of your grade due that week. Every cell also prints its number,
 * so color is never the only signal.
 */
export function CrunchStrip({ weeks, heavy, currentWeek }: { weeks: WeekLoad[]; heavy: Set<string>; currentWeek: string }) {
  const max = Math.max(30, ...weeks.map((w) => w.totalWeight));
  return (
    <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
      {weeks.map((w) => {
        const level = w.totalWeight / max;
        return (
          <li key={w.weekStart} className="flex flex-col gap-1">
            <span className={`num text-xs ${w.weekStart === currentWeek ? "bg-highlight px-1 font-medium" : "text-ink-muted"}`}>
              {w.weekStart === currentWeek ? "This week" : formatKeyShort(w.weekStart)}
            </span>
            <span
              className="flex h-12 flex-col justify-end rounded-sm border border-rule p-1"
              style={{ backgroundColor: `color-mix(in srgb, var(--ink) ${Math.round(level * 70)}%, transparent)` }}
            >
              <span className={`num rounded-sm bg-paper px-1 text-xs ${heavy.has(w.weekStart) ? "font-medium" : ""}`}>
                {Math.round(w.totalWeight)}%{w.unweightedCount > 0 ? ` +${w.unweightedCount}` : ""}
              </span>
            </span>
            {heavy.has(w.weekStart) && <span className="text-xs font-medium">Heavy week</span>}
          </li>
        );
      })}
    </ol>
  );
}
