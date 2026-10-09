import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { courseLabel, formatKeyLong, formatTime, formatWeight } from "@/lib/format";
import { dateKey } from "@/lib/time";

/**
 * What the course assistant knows about a student's courses, as plain text for the model: parsed syllabus
 * facts and the calendar (syllabus and Canvas items). Pure formatting, so it can be tested; the route loads
 * the rows. The result is reference material and goes in the conversation, never in the system prompt.
 */

export interface ContextCourse {
  id: string;
  code: string | null;
  section: string | null;
  title: string | null;
  term: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
}

export interface ContextEvent {
  course_id: string | null;
  title: string;
  kind: string;
  starts_at: string;
  all_day: boolean;
  weight_percent: number | string | null;
  source: string;
}

const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}` : null);

function courseBlock(course: ContextCourse, parsed: ParsedSyllabus | undefined, events: ContextEvent[], tz: string) {
  const name = `${courseLabel(course)}${course.section ? `.${course.section}` : ""}`;
  const out: (string | null)[] = [`## ${name}${course.title ? ` ${course.title}` : ""}${course.term ? ` (${course.term})` : ""}`];
  const instructor = [course.instructor_name, course.instructor_email && `<${course.instructor_email}>`, parsed?.instructor.office && `office ${parsed.instructor.office}`]
    .filter(Boolean)
    .join(", ");
  out.push(line("Instructor", instructor));

  if (!parsed) {
    out.push("No syllabus uploaded for this course yet.");
  } else {
    const grading = parsed.grading
      .map((g) => `${g.name} ${formatWeight(g.weight_percent) ?? "(weight not stated)"}${g.drop_lowest ? ` (drop lowest ${g.drop_lowest})` : ""}`)
      .join("; ");
    out.push(line("Grading", grading || "not stated"));
    out.push(line("Grade scale", parsed.grade_scale.map((s) => `${s.letter} ${s.min_percent}+`).join(", ")));
    const p = parsed.policies;
    out.push(line("Late work policy", p.late_work));
    out.push(line("Attendance policy", p.attendance));
    out.push(line("Makeup exams", p.makeup_exams));
    out.push(line("Curve", p.curve));
    out.push(line("AI use policy", p.ai_usage ?? "not stated in the syllabus"));
    out.push(
      line(
        "Class meetings",
        parsed.meetings
          .map((m) => `${m.kind} ${m.days.join("/")} ${[m.start, m.end].filter(Boolean).join("-")} ${m.location ?? ""}`.trim())
          .join("; "),
      ),
    );
    out.push(line("Required materials", parsed.required_materials.join("; ")));
    out.push(line("Not stated in the syllabus", parsed.missing.join("; ")));
    const undated = parsed.graded_items.filter((i) => !i.due_date);
    out.push(line("Graded items without a date", undated.map((i) => `${i.title}${i.weight_percent != null ? ` (${formatWeight(i.weight_percent)})` : ""}`).join("; ")));
  }

  if (events.length) {
    out.push("Calendar:");
    for (const e of events) {
      const when = `${formatKeyLong(dateKey(new Date(e.starts_at), tz))}${e.all_day ? "" : `, ${formatTime(e.starts_at, tz)}`}`;
      const weight = e.weight_percent == null ? "" : `, ${formatWeight(Number(e.weight_percent))} of course grade`;
      out.push(`- ${when}: ${e.title} [${e.kind}]${weight} (from ${e.source === "ics" ? "Canvas" : e.source})`);
    }
  }
  return out.filter(Boolean).join("\n");
}

export function formatCourseContext(input: {
  courses: ContextCourse[];
  syllabi: Map<string, ParsedSyllabus>;
  events: ContextEvent[];
  tz: string;
  now: Date;
}): string {
  const { courses, syllabi, events, tz, now } = input;
  // Date only: the text is a cached prefix, so it should change at most once a day.
  const header = `Today is ${formatKeyLong(dateKey(now, tz))} (time zone ${tz}).`;
  if (courses.length === 0) return `${header}\nThe student hasn't added any courses yet.`;
  const other = events.filter((e) => !e.course_id || !courses.some((c) => c.id === e.course_id));
  return [
    header,
    ...courses.map((c) => courseBlock(c, syllabi.get(c.id), events.filter((e) => e.course_id === c.id), tz)),
    ...(other.length && courses.length > 1 ? [courseBlock({ id: "", code: "Other", section: null, title: null, term: null, instructor_name: null, instructor_email: null }, undefined, other, tz)] : []),
  ].join("\n\n");
}
