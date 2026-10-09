"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { CALENDAR_MODE, describeWhen, type Change } from "@/lib/calendar/quick-add";

/** Quick-add replies carry proposed calendar changes that the student saves or discards. */
type Message = { role: "user" | "assistant"; content: string; changes?: Change[]; status?: "pending" | "saving" | "saved" | "discarded" };

const VERB = { add: "Add", move: "Move", remove: "Remove" } as const;
type Course = { id: string; label: string };
export type Mode = { id: string; title: string; blurb: string; hint: string; usesFiles: boolean };

const STARTERS = [
  "What's due this week?",
  "When is my next exam, and how much is it worth?",
  "What's the late work policy?",
  "What does the syllabus leave out?",
];

/** The conversation: course and mode pickers, messages (streamed), and the question box. */
export function ChatPanel({
  courses,
  courseId,
  modes,
  mode: modeId,
  threadId,
  initialMessages,
}: {
  courses: Course[];
  courseId: string | null;
  modes: Mode[];
  mode: string | null;
  threadId: string | null;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const mode = modes.find((m) => m.id === modeId) ?? null;
  const go = (course: string | null, m: string | null) => {
    const params = new URLSearchParams({ ...(course ? { course } : {}), ...(m ? { mode: m } : {}) });
    router.push(params.size ? `/chat?${params}` : "/chat");
  };

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    if (modeId === CALENDAR_MODE) return quickAdd(text);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, ...(threadId ? { threadId } : { courseId, ...(modeId ? { mode: modeId } : {}) }) }),
    }).catch(() => null);

    if (!res?.ok || !res.body) {
      const json = await res?.json().catch(() => ({}));
      setMessages((m) => m.slice(0, -2));
      setDraft(text);
      setError(json?.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + chunk }]);
    }
    setBusy(false);
    const newThread = res.headers.get("X-Thread-Id");
    if (!threadId && newThread) router.replace(`/chat?thread=${newThread}`, { scroll: false });
    else router.refresh();
  }

  function fail(text: string, message: string) {
    setMessages((m) => m.slice(0, -2));
    setDraft(text);
    setError(message);
    setBusy(false);
  }

  async function quickAdd(text: string) {
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    const res = await fetch("/api/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history, courseId }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!res?.ok || !json) return fail(text, json?.error ?? "Something went wrong. Please try again.");
    const changes: Change[] = json.changes ?? [];
    setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: json.reply, changes, status: changes.length ? "pending" : undefined }]);
    setBusy(false);
  }

  const setStatus = (i: number, status: Message["status"]) => setMessages((m) => m.map((x, j) => (j === i ? { ...x, status } : x)));

  async function save(i: number) {
    setStatus(i, "saving");
    setError(null);
    const res = await fetch("/api/quick-add/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: messages[i].changes }),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus(i, "pending");
      setError("Couldn't save those changes. Please try again.");
      return;
    }
    setStatus(i, "saved");
    router.refresh();
  }

  return (
    <div className="flex min-h-[28rem] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex max-w-full flex-wrap items-center gap-3">
          <span className="label">Course</span>
          <select
            className="input w-auto max-w-full"
            value={courseId ?? ""}
            disabled={Boolean(threadId) || busy}
            onChange={(e) => go(e.target.value || null, modeId)}
          >
            <option value="">All my courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="flex max-w-full flex-wrap items-center gap-3">
          <span className="label">Mode</span>
          <select
            className="input w-auto max-w-full"
            value={modeId ?? ""}
            disabled={Boolean(threadId) || busy}
            onChange={(e) => go(courseId, e.target.value || null)}
          >
            <option value="">Ask about my courses</option>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div role="log" aria-live="polite" aria-busy={busy} className="flex flex-1 flex-col gap-4 border-y border-rule py-4">
        {messages.length === 0 && mode ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{mode.title}</p>
            <p className="text-ink-muted">{mode.blurb} {mode.hint}</p>
            {mode.usesFiles && (
              <p className="text-sm text-ink-muted">
                {courseId
                  ? "Your latest uploaded files for this course are included."
                  : "Pick a course to include its uploaded notes, slides and past exams."}
              </p>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-ink-muted">
              Ask anything about your {courseId ? "course" : "courses"}: due dates, grade weights, policies. Answers come from your
              syllabi and Canvas calendar.
            </p>
            <ul className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button type="button" className="btn-secondary text-sm" onClick={() => ask(s)} disabled={busy}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "self-end max-w-[85%] rounded-md bg-rule/60 px-3 py-2" : "max-w-[85%]"}>
              <span className="sr-only">{m.role === "user" ? "You:" : "Syllabase:"}</span>
              {m.role === "assistant" && m.content ? <Markdown>{m.content}</Markdown> : <p className="whitespace-pre-wrap">{m.content || (busy ? "Thinking…" : "")}</p>}
              {m.changes && m.changes.length > 0 && (
                <div className="mt-3 flex flex-col gap-3 rounded-md border border-rule p-3">
                  <ul className="flex flex-col gap-1 text-sm">
                    {m.changes.map((c, j) => (
                      <li key={j}>
                        <span className="font-medium">{VERB[c.action]}</span>{" "}
                        {c.courseLabel && <span className="num">{c.courseLabel} </span>}
                        {c.title}
                        {c.date && (
                          <>
                            {c.action === "move" ? " to " : ", "}
                            <span className="num whitespace-nowrap">{describeWhen(c.date, c.time)}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {m.status === "saved" ? (
                    <p className="text-sm">
                      Saved. <Link href="/calendar" className="underline underline-offset-2">See your calendar</Link>
                    </p>
                  ) : m.status === "discarded" ? (
                    <p className="text-sm text-ink-muted">Not saved.</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button type="button" className="btn-primary" disabled={m.status === "saving"} onClick={() => save(i)}>
                        {m.status === "saving" ? "Saving" : "Save to calendar"}
                      </button>
                      <button type="button" className="btn-quiet" disabled={m.status === "saving"} onClick={() => setStatus(i, "discarded")}>
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="question" className="sr-only">Your question</label>
        <textarea
          id="question"
          rows={2}
          maxLength={4000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(draft);
            }
          }}
          placeholder={mode ? mode.hint : "Ask about deadlines, weights or policies"}
          className="input resize-y"
        />
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
            {busy ? "Answering" : mode ? "Send" : "Ask"}
          </button>
          <p aria-live="polite" className="text-sm text-ink-muted">{error}</p>
        </div>
      </form>
    </div>
  );
}
