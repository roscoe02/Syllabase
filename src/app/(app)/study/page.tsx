import { Suspense } from "react";
import { listCourses } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { courseLabel } from "@/lib/format";
import { PRESETS } from "@/lib/study/presets";
import { StudyPanel, type Tool } from "./study-panel";

export const metadata = { title: "Study · Syllabase" };

const FOCUS_HINTS: Partial<Record<string, string>> = {
  time: "How much time do you have, and what's stressing you?",
  topic: "A topic or chapters, e.g. chapters 3 and 4",
};

/** One-shot tools only; the conversational ones will live in chat. */
const TOOLS: Tool[] = PRESETS.filter((p) => p.mode === "one-shot" && p.output !== "plan" && p.id !== "essay-feedback").map((p) => ({
  id: p.id,
  title: p.title,
  blurb: p.blurb,
  needsMaterials: p.inputs.includes("materials"),
  focusHint: FOCUS_HINTS[p.inputs.find((i) => FOCUS_HINTS[i]) ?? "topic"] ?? "",
}));

export default function StudyPage({ searchParams }: PageProps<"/study">) {
  return (
    <main className="flex flex-col gap-6">
      <header className="no-print flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Study tools</h1>
        <p className="text-ink-muted">Turn your notes, slides and past exams into cheat sheets, flashcards and practice quizzes.</p>
      </header>
      <Suspense fallback={<div className="skeleton h-96 w-full" aria-busy="true" aria-label="Loading study tools" />}>
        <Study searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Study({ searchParams }: { searchParams: PageProps<"/study">["searchParams"] }) {
  const { supabase } = await getCurrentUser();
  const [courses, { data: documents }, params] = await Promise.all([
    listCourses(supabase),
    supabase.from("documents").select("id, course_id, filename, kind").not("course_id", "is", null).order("created_at"),
    searchParams,
  ]);
  const course = typeof params.course === "string" && courses.some((c) => c.id === params.course) ? params.course : null;
  return (
    <StudyPanel
      tools={TOOLS}
      courses={courses.map((c) => ({ id: c.id, label: `${courseLabel(c)}${c.title ? ` ${c.title}` : ""}` }))}
      documents={(documents ?? []).map((d) => ({ id: d.id, courseId: d.course_id as string, filename: d.filename, kind: d.kind }))}
      initialCourse={course}
    />
  );
}
