"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import type { Flashcards, Quiz } from "@/lib/study/outputs";
import { FlashcardDeck } from "./flashcard-deck";
import { QuizView } from "./quiz-view";

export type Tool = { id: string; title: string; blurb: string; needsMaterials: boolean; focusHint: string };
type Course = { id: string; label: string };
type Doc = { id: string; courseId: string; filename: string; kind: string };
type Result = { kind: "text"; text: string } | { kind: "flashcards"; result: Flashcards } | { kind: "quiz"; result: Quiz };

const MAX_FILES = 5;

/** Pick a tool, a course and its files, then generate. */
export function StudyPanel({ tools, courses, documents, initialCourse }: { tools: Tool[]; courses: Course[]; documents: Doc[]; initialCourse: string | null }) {
  const [toolId, setToolId] = useState(tools[0]?.id ?? "");
  const [courseId, setCourseId] = useState(initialCourse ?? courses[0]?.id ?? "");
  const courseDocs = documents.filter((d) => d.courseId === courseId);
  const [selected, setSelected] = useState<string[]>(courseDocs.slice(0, MAX_FILES).map((d) => d.id));
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const tool = tools.find((t) => t.id === toolId)!;

  function pickCourse(id: string) {
    setCourseId(id);
    setSelected(documents.filter((d) => d.courseId === id).slice(0, MAX_FILES).map((d) => d.id));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: toolId, courseId: courseId || null, documentIds: selected, ...(focus.trim() ? { focus } : {}) }),
    }).catch(() => null);
    if (!res?.ok || !res.body) {
      const json = await res?.json().catch(() => ({}));
      setError(json?.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    if (res.headers.get("Content-Type")?.includes("application/json")) {
      const json = await res.json();
      setResult({ kind: json.kind, result: json.result });
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setResult({ kind: "text", text });
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="no-print flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Tool</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <label key={t.id} className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 ${t.id === toolId ? "border-ink" : "border-rule hover:border-ink-muted"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="tool" value={t.id} checked={t.id === toolId} onChange={() => setToolId(t.id)} />
                  <span className="font-medium">{t.title}</span>
                </span>
                <span className="text-sm text-ink-muted">{t.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="label">Course</span>
            <select className="input" value={courseId} onChange={(e) => pickCourse(e.target.value)}>
              {!tool.needsMaterials && <option value="">All my courses</option>}
              {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Focus <span className="font-normal text-ink-muted">(optional)</span></span>
            <input className="input" value={focus} maxLength={4000} onChange={(e) => setFocus(e.target.value)} placeholder={tool.focusHint} />
          </label>
        </div>

        {courseId && (
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1">Files to use <span className="font-normal text-ink-muted">(up to {MAX_FILES})</span></legend>
            {courseDocs.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No files for this course yet. Upload notes or slides on the course page{tool.needsMaterials ? ", or type a topic above" : ""}.
              </p>
            ) : (
              courseDocs.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(d.id)}
                    disabled={!selected.includes(d.id) && selected.length >= MAX_FILES}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                  />
                  <span className="break-all">{d.filename}</span>
                  <span className="text-ink-muted">{d.kind.replace("_", " ")}</span>
                </label>
              ))
            )}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn-primary" onClick={generate} disabled={busy || (tool.needsMaterials && !courseId)}>
            {busy ? "Working" : "Generate"}
          </button>
          <p aria-live="polite" className="text-sm text-ink-muted">{busy && !result ? "Reading your materials. This can take up to a minute." : error}</p>
        </div>
      </div>

      {result && (
        <section aria-labelledby="result-h" className="flex flex-col gap-4 border-t border-rule pt-6">
          <div className="no-print flex flex-wrap items-center gap-3">
            <h2 id="result-h" className="mr-auto font-medium">{tool.title}</h2>
            {result.kind === "text" && !busy && (
              <>
                <button type="button" className="btn-quiet" onClick={() => navigator.clipboard.writeText(result.text)}>Copy</button>
                <button type="button" className="btn-secondary" onClick={() => window.print()}>Print</button>
              </>
            )}
          </div>
          {result.kind === "text" && <Markdown>{result.text}</Markdown>}
          {result.kind === "flashcards" && <FlashcardDeck cards={result.result.cards} />}
          {result.kind === "quiz" && <QuizView questions={result.result.questions} />}
        </section>
      )}
    </div>
  );
}
