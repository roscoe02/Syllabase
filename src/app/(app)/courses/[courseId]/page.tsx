import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCourse, getProfile } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { courseLabel, formatDay, formatTime, formatWeight } from "@/lib/format";
import { deleteCourse, removeDocument } from "./actions";
import { GradesSection } from "./grades-section";
import { MaterialsUpload } from "./materials-upload";

export default function CoursePage({ params }: PageProps<"/courses/[courseId]">) {
  return (
    <main className="flex flex-col gap-10">
      <Suspense fallback={<CourseSkeleton />}>
        <Course params={params} />
      </Suspense>
    </main>
  );
}

const POLICY_LABELS = [
  ["late_work", "Late work"],
  ["attendance", "Attendance"],
  ["makeup_exams", "Makeup exams"],
  ["curve", "Curve"],
  ["ai_usage", "AI use"],
] as const;

async function Course({ params }: { params: PageProps<"/courses/[courseId]">["params"] }) {
  const { courseId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const { supabase } = await getCurrentUser();
  const [data, { timezone: tz }] = await Promise.all([getCourse(supabase, courseId), getProfile(supabase)]);
  if (!data) notFound(); // also what another student's course id looks like, thanks to RLS

  const { course, syllabus, events, documents, weights, entries } = data;
  const parsed = syllabus?.parsed;
  const undated = parsed?.graded_items.filter((i) => !i.due_date) ?? [];
  const now = new Date().toISOString();

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="num text-ink-muted">{courseLabel(course)}{course.section ? `.${course.section}` : ""} · {course.term}</p>
        <h1 className="text-2xl font-semibold">{course.title ?? courseLabel(course)}</h1>
        {course.instructor_name && (
          <p className="text-ink-muted">
            {course.instructor_name}
            {course.instructor_email && (
              <> · <a href={`mailto:${course.instructor_email}`} className="underline underline-offset-2">{course.instructor_email}</a></>
            )}
          </p>
        )}
      </header>

      {syllabus && syllabus.freshness !== "current" && (
        <div role="note" className="rounded-md border-2 border-ink p-4">
          <p className="font-medium">This syllabus may be outdated.</p>
          <p className="mt-1 text-ink-muted">{syllabus.freshness_reason} Upload the current one from your course page when you have it.</p>
        </div>
      )}

      {parsed && parsed.missing.length > 0 && (
        <section aria-labelledby="missing-h">
          <h2 id="missing-h" className="font-medium">Not in the syllabus</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Things students usually need that this syllabus doesn&apos;t say. Check Canvas or ask your professor.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {parsed.missing.map((m) => <li key={m} className="rounded-sm border border-dashed border-ink-muted px-2 py-1 text-sm">{m}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="grading-h" className="flex flex-col gap-3">
        <h2 id="grading-h" className="font-medium">Grading</h2>
        {parsed && parsed.grading.length > 0 ? (
          <table className="w-full max-w-xl border-collapse">
            <thead>
              <tr className="border-b border-rule text-left text-sm text-ink-muted">
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Weight</th>
                <th scope="col" className="py-2 text-right font-medium">Drops</th>
              </tr>
            </thead>
            <tbody>
              {parsed.grading.map((g) => (
                <tr key={g.name} className="border-b border-rule">
                  <th scope="row" className="py-2 text-left font-normal">{g.name}</th>
                  <td className="num py-2 text-right">{formatWeight(g.weight_percent) ?? <span className="text-ink-muted">missing</span>}</td>
                  <td className="num py-2 text-right text-ink-muted">{g.drop_lowest ? `lowest ${g.drop_lowest}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-muted">No grade weights in the syllabus.</p>
        )}
      </section>

      <GradesSection courseId={course.id} parsed={parsed ?? null} weights={weights} entries={entries} />

      <section aria-labelledby="dates-h" className="flex flex-col gap-3">
        <h2 id="dates-h" className="font-medium">Exams and due dates</h2>
        {events.length === 0 && undated.length === 0 ? (
          <p className="text-ink-muted">No dated items yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {events.map((e) => (
              <li key={e.id} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 ${e.starts_at < now && !e.all_day ? "text-ink-muted" : ""}`}>
                <span className="num w-28 shrink-0 text-sm">{formatDay(e.starts_at, tz)}</span>
                <span className="num w-16 shrink-0 text-sm text-ink-muted">{e.all_day ? "" : formatTime(e.starts_at, tz)}</span>
                <span className={e.kind === "exam" ? "font-medium" : ""}>{e.title}</span>
                {formatWeight(e.weight_percent == null ? null : Number(e.weight_percent)) && (
                  <span className="num text-sm text-ink-muted">{formatWeight(Number(e.weight_percent))}</span>
                )}
                {e.source === "ics" && <span className="text-xs text-ink-muted">from your LMS</span>}
              </li>
            ))}
            {undated.map((i, n) => (
              <li key={`undated-${n}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="w-28 shrink-0 text-sm text-ink-muted">No date yet</span>
                <span className="w-16 shrink-0" />
                <span>{i.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="materials-h" className="flex flex-col gap-3">
        <div>
          <h2 id="materials-h" className="font-medium">Study materials</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Notes, slides, past exams or rubrics. Study tools build cheat sheets, quizzes and flashcards from them.
          </p>
        </div>
        {documents.length > 0 && (
          <ul className="divide-y divide-rule border-y border-rule">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="mr-auto break-all">{d.filename}</span>
                <span className="text-sm text-ink-muted">{d.kind.replace("_", " ")}</span>
                <form action={removeDocument.bind(null, d.id)}>
                  <ConfirmSubmit message={`Remove ${d.filename}?`} className="btn-quiet px-0 text-sm">Remove</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <MaterialsUpload courseId={course.id} />
          {documents.length > 0 && (
            <Link href={`/study?course=${course.id}`} className="btn-secondary">Study with these</Link>
          )}
        </div>
      </section>

      {parsed && POLICY_LABELS.some(([k]) => parsed.policies[k]) && (
        <section aria-labelledby="policies-h" className="flex flex-col gap-3">
          <h2 id="policies-h" className="font-medium">Policies</h2>
          <dl className="divide-y divide-rule border-y border-rule">
            {POLICY_LABELS.filter(([k]) => parsed.policies[k]).map(([k, label]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-medium">{label}</dt>
                <dd className="text-ink-muted">{parsed.policies[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6 text-sm">
        <Link href={`/chat?course=${course.id}`} className="btn-secondary">Ask about this course</Link>
        <Link href="/courses/new" className="text-ink-muted underline underline-offset-2">Add another course</Link>
        <form action={deleteCourse.bind(null, course.id)}>
          <ConfirmSubmit
            message={`Remove ${courseLabel(course)}? Its calendar items and uploaded syllabus are deleted too.`}
            className="btn-quiet px-0"
          >
            Remove this course
          </ConfirmSubmit>
        </form>
      </div>
    </>
  );
}

function CourseSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading course">
      <div className="skeleton h-8 w-72" />
      <div className="skeleton h-32 w-full max-w-xl" />
      <div className="skeleton h-48 w-full" />
    </div>
  );
}
