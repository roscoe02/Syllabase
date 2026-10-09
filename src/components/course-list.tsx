import Link from "next/link";
import type { CalendarEvent, CourseSummary } from "@/lib/data/queries";
import { courseLabel, formatDay, formatTime } from "@/lib/format";

/** The student's courses, with what the syllabus leaves out and, when given, the next thing due. */
export function CourseList({
  courses,
  status,
  next,
  tz,
}: {
  courses: CourseSummary[];
  status: Map<string, { freshness: string; missing: string[] }>;
  next?: Map<string, CalendarEvent>;
  tz: string;
}) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {courses.map((c) => {
        const s = status.get(c.id);
        const due = next?.get(c.id);
        return (
          <li key={c.id} className="flex flex-col gap-1 py-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Link href={`/courses/${c.id}`} className="num font-medium underline-offset-2 hover:underline">
                {courseLabel(c)}{c.section ? `.${c.section}` : ""}
              </Link>
              <span className="text-ink-muted">{c.title}</span>
              {next && c.instructor_name && <span className="text-sm text-ink-muted">{c.instructor_name}</span>}
            </div>
            {next && (
              <p className="text-sm">
                {due ? (
                  <>
                    Next: <span className={due.kind === "exam" ? "font-medium" : ""}>{due.title}</span>,{" "}
                    <span className="num whitespace-nowrap">
                      {formatDay(due.startsAt, tz)}
                      {due.allDay ? "" : `, ${formatTime(due.startsAt, tz)}`}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-muted">Nothing due soon.</span>
                )}
              </p>
            )}
            {((s && s.missing.length > 0) || s?.freshness === "outdated") && (
              <p className="flex flex-wrap gap-x-4 text-sm">
                {s.missing.length > 0 && (
                  <Link href={`/courses/${c.id}#missing-h`} className="text-ink-muted underline-offset-2 hover:underline">
                    Not in syllabus: {s.missing.slice(0, 2).join(", ")}
                    {s.missing.length > 2 && ` and ${s.missing.length - 2} more`}
                  </Link>
                )}
                {s.freshness === "outdated" && <span className="font-medium">Syllabus may be outdated</span>}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
