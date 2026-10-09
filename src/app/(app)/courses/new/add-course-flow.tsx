"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SyllabusReview } from "@/components/syllabus-review";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { createClient } from "@/lib/supabase/client";
import type { Freshness, TermWindow } from "@/lib/syllabus/staleness";

const MAX_BYTES = 20 * 1024 * 1024;

type Step =
  | { name: "choose"; error?: string }
  | { name: "working"; message: string }
  | { name: "review"; documentId: string; syllabus: ParsedSyllabus; freshness: Freshness | null; error?: string }
  | { name: "saving"; documentId: string; syllabus: ParsedSyllabus; freshness: Freshness | null };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json as T;
}

export function AddCourseFlow({ terms }: { terms: TermWindow[] }) {
  const router = useRouter();
  const [termName, setTermName] = useState(terms[0].name);
  const [firstDay, setFirstDay] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>({ name: "choose" });

  const term: TermWindow = terms.find((t) => t.name === termName)!;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf") return setStep({ name: "choose", error: "Upload a PDF. Word and photo support is coming." });
    if (file.size > MAX_BYTES) return setStep({ name: "choose", error: "That file is over 20 MB." });

    try {
      setStep({ name: "working", message: "Uploading" });
      const up = await postJson<{ documentId: string; path: string; token: string }>("/api/uploads", {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        kind: "syllabus",
      });
      const { error } = await createClient().storage.from("documents").uploadToSignedUrl(up.path, up.token, file, {
        contentType: file.type,
      });
      if (error) throw new Error("Upload failed. Please try again.");

      setStep({ name: "working", message: "Reading your syllabus. This usually takes 10 to 30 seconds." });
      const parsed = await postJson<{ syllabus: ParsedSyllabus; freshness: Freshness | null }>("/api/syllabus/parse", {
        documentId: up.documentId,
        term,
        ...(firstDay ? { firstDay } : {}),
      });
      setStep({ name: "review", documentId: up.documentId, syllabus: parsed.syllabus, freshness: parsed.freshness });
    } catch (err) {
      setStep({ name: "choose", error: (err as Error).message });
    }
  }

  async function save() {
    if (step.name !== "review") return;
    setStep({ ...step, name: "saving" });
    try {
      const { courseId } = await postJson<{ courseId: string }>("/api/syllabus/confirm", {
        documentId: step.documentId,
        term,
        syllabus: step.syllabus,
      });
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setStep({ ...step, name: "review", error: (err as Error).message });
    }
  }

  if (step.name === "working") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <p role="status">{step.message}</p>
        <div className="skeleton h-6 w-2/3" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (step.name === "review" || step.name === "saving") {
    return (
      <div className="flex flex-col gap-8">
        <p className="text-ink-muted">
          Check what we found. Fix anything that&apos;s wrong, then save. Nothing goes on your calendar until you do.
        </p>
        <SyllabusReview
          value={step.syllabus}
          freshness={step.freshness}
          onChange={(syllabus) => step.name === "review" && setStep({ ...step, syllabus })}
        />
        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <button type="button" className="btn-primary" onClick={save} disabled={step.name === "saving"}>
            {step.name === "saving" ? "Saving" : "Save course"}
          </button>
          <button type="button" className="btn-quiet" onClick={() => setStep({ name: "choose" })} disabled={step.name === "saving"}>
            Start over
          </button>
          <p aria-live="polite" className="text-sm">{step.name === "review" ? step.error : null}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={start} className="flex max-w-xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="label">Term</span>
          <select className="input" value={termName} onChange={(e) => setTermName(e.target.value)}>
            {terms.map((t) => <option key={t.name}>{t.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">
            First day of classes <span className="font-normal text-ink-muted">(optional)</span>
          </span>
          <input type="date" className="input num" value={firstDay} onChange={(e) => setFirstDay(e.target.value)} />
        </label>
      </div>
      <p className="-mt-3 text-sm text-ink-muted">
        The first day helps turn &quot;Week 5, Tuesday&quot; into a real date. Without it, those items stay undated.
      </p>

      <label className="flex flex-col gap-1">
        <span className="label">Syllabus (PDF, up to 20 MB)</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input file:mr-3 file:rounded-sm file:border-0 file:bg-accent file:px-3 file:py-1 file:text-accent-ink"
        />
      </label>
      <p className="-mt-3 text-sm text-ink-muted">
        Use the newest version from your course page or professor. The one on CourseBook is often last semester&apos;s.
      </p>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={!file}>
          Read syllabus
        </button>
        <p aria-live="polite" className="text-sm">{step.error}</p>
      </div>
    </form>
  );
}
