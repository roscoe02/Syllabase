import Link from "next/link";
import { Suspense } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { listCourses } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { courseLabel } from "@/lib/format";
import { getStudyMode, PRESETS, usesFiles } from "@/lib/study/presets";
import { deleteThread } from "./actions";
import { ChatPanel, type Mode } from "./chat-panel";

export const metadata = { title: "Chat · Syllabase" };

const UUID = /^[0-9a-f-]{36}$/i;

const MODE_HINTS: Record<string, string> = {
  "feynman-check": "Name a concept, then explain it as if you were teaching it.",
  "explain-like-im-failing": "Name the topic that isn't clicking and what you've tried.",
  "lecture-recovery": "Say which lecture and where you got lost.",
  "study-coach": "Say which exam you're preparing for. Send \"go\" when you're ready for the diagnostic.",
  opposition: "Paste your thesis.",
  "problem-walkthrough": "Paste the problem and your attempt so far.",
  "error-finder": "Paste the problem and your work.",
};

const MODES: Mode[] = PRESETS.filter((p) => p.mode === "interactive").map((p) => ({
  id: p.id,
  title: p.title,
  blurb: p.blurb,
  hint: MODE_HINTS[p.id] ?? "",
  usesFiles: usesFiles(p),
}));

export default function ChatPage({ searchParams }: PageProps<"/chat">) {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Chat</h1>
      <Suspense fallback={<div className="skeleton h-96 w-full" aria-busy="true" aria-label="Loading chat" />}>
        <Chat searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Chat({ searchParams }: { searchParams: PageProps<"/chat">["searchParams"] }) {
  const { supabase } = await getCurrentUser();
  const params = await searchParams;
  const threadParam = typeof params.thread === "string" && UUID.test(params.thread) ? params.thread : null;
  const courseParam = typeof params.course === "string" && UUID.test(params.course) ? params.course : null;
  const modeParam = typeof params.mode === "string" && MODES.some((m) => m.id === params.mode) ? params.mode : null;

  const [courses, { data: threads }, { data: thread }] = await Promise.all([
    listCourses(supabase),
    supabase.from("chat_threads").select("id, title, course_id, preset_id").order("created_at", { ascending: false }).limit(15),
    threadParam
      ? supabase.from("chat_threads").select("id, course_id, preset_id").eq("id", threadParam).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const courseId = thread?.course_id ?? (courses.some((c) => c.id === courseParam) ? courseParam : null);
  const mode = thread ? (getStudyMode(thread.preset_id)?.id ?? null) : modeParam;

  const [{ data: messages }, { data: syllabus }] = await Promise.all([
    thread
      ? supabase.from("chat_messages").select("role, content").eq("thread_id", thread.id).order("created_at")
      : Promise.resolve({ data: [] }),
    courseId
      ? supabase.from("syllabi").select("parsed->policies->>ai_usage").eq("course_id", courseId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const aiPolicy = (syllabus as { ai_usage?: string | null } | null)?.ai_usage ?? null;
  const label = (id: string | null) => {
    const c = courses.find((x) => x.id === id);
    return c ? `${courseLabel(c)}${c.section ? `.${c.section}` : ""}` : "All courses";
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_14rem]">
      <div className="flex flex-col gap-4">
        {courseId && (
          <p className="rounded-md border border-rule p-3 text-sm">
            <span className="font-medium">{label(courseId)} AI policy: </span>
            <span className="text-ink-muted">{aiPolicy ?? "The syllabus doesn't say. Check with your professor before using AI on graded work."}</span>
          </p>
        )}
        <ChatPanel
          key={thread?.id ?? `new-${courseId ?? "all"}-${mode ?? "ask"}`}
          courses={courses.map((c) => ({ id: c.id, label: `${courseLabel(c)}${c.title ? ` ${c.title}` : ""}` }))}
          courseId={courseId}
          modes={MODES}
          mode={mode}
          threadId={thread?.id ?? null}
          initialMessages={(messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }))}
        />
      </div>

      <aside aria-labelledby="recent-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-h" className="font-medium">Recent chats</h2>
          <Link href="/chat" className="btn-quiet text-sm">New chat</Link>
        </div>
        {(threads ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">Your conversations show up here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rule border-y border-rule">
            {(threads ?? []).map((t) => (
              <li key={t.id} className="py-2">
                <Link
                  href={`/chat?thread=${t.id}`}
                  aria-current={t.id === thread?.id ? "page" : undefined}
                  className={`block text-sm underline-offset-2 hover:underline ${t.id === thread?.id ? "font-medium" : ""}`}
                >
                  <span className="line-clamp-2">{t.title ?? "Untitled chat"}</span>
                  <span className="num block text-xs text-ink-muted">
                    {label(t.course_id)}
                    {getStudyMode(t.preset_id) && ` · ${getStudyMode(t.preset_id)?.title}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {thread && (
          <form action={deleteThread.bind(null, thread.id)}>
            <ConfirmSubmit message="Delete this chat?" className="btn-quiet px-0 text-sm">Delete this chat</ConfirmSubmit>
          </form>
        )}
      </aside>
    </div>
  );
}
