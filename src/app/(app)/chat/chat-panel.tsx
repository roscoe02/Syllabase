"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Course = { id: string; label: string };

const STARTERS = [
  "What's due this week?",
  "When is my next exam, and how much is it worth?",
  "What's the late work policy?",
  "What does the syllabus leave out?",
];

/** Renders **bold** spans as <strong>; everything else stays plain text (React escapes it, so no HTML gets through). */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-medium">{part}</strong> : part));
}

/** The conversation: course picker, messages (streamed), and the question box. */
export function ChatPanel({
  courses,
  courseId,
  threadId,
  initialMessages,
}: {
  courses: Course[];
  courseId: string | null;
  threadId: string | null;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

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

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, ...(threadId ? { threadId } : { courseId }) }),
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

  return (
    <div className="flex min-h-[28rem] flex-col gap-4">
      <label className="flex flex-wrap items-center gap-3">
        <span className="label">Ask about</span>
        <select
          className="input w-auto"
          value={courseId ?? ""}
          disabled={Boolean(threadId) || busy}
          onChange={(e) => router.push(e.target.value ? `/chat?course=${e.target.value}` : "/chat")}
        >
          <option value="">All my courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </label>

      <div role="log" aria-live="polite" aria-busy={busy} className="flex flex-1 flex-col gap-4 border-y border-rule py-4">
        {messages.length === 0 ? (
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
              <p className="whitespace-pre-wrap">{m.content ? withBold(m.content) : busy ? "Thinking…" : ""}</p>
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
          placeholder="Ask about deadlines, weights or policies"
          className="input resize-y"
        />
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
            {busy ? "Answering" : "Ask"}
          </button>
          <p aria-live="polite" className="text-sm text-ink-muted">{error}</p>
        </div>
      </form>
    </div>
  );
}
