"use client";

import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import type { Freshness } from "@/lib/syllabus/staleness";

type Item = ParsedSyllabus["graded_items"][number];
type Component = ParsedSyllabus["grading"][number];

const KINDS: Item["kind"][] = ["exam", "quiz", "homework", "project", "paper", "lab", "presentation", "participation", "other"];

/**
 * Editable view of a parsed syllabus. Nothing here is saved until the student confirms; anything the
 * syllabus didn't state stays empty and is called out, never filled in for them.
 */
export function SyllabusReview({
  value,
  onChange,
  freshness,
}: {
  value: ParsedSyllabus;
  onChange: (next: ParsedSyllabus) => void;
  freshness: Freshness | null;
}) {
  const set = <K extends keyof ParsedSyllabus>(key: K, v: ParsedSyllabus[K]) => onChange({ ...value, [key]: v });
  const setComponent = (i: number, patch: Partial<Component>) =>
    set("grading", value.grading.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setItem = (i: number, patch: Partial<Item>) =>
    set("graded_items", value.graded_items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const total = value.grading.reduce((s, c) => s + (c.weight_percent ?? 0), 0);
  const undated = value.graded_items.filter((i) => !i.due_date).length;

  return (
    <div className="flex flex-col gap-10">
      {freshness && freshness.status !== "current" && (
        <div role="alert" className="rounded-md border-2 border-ink p-4">
          <p className="font-medium">
            {freshness.status === "outdated" ? "This may be an old syllabus." : "We can't tell which term this syllabus is for."}
          </p>
          <p className="mt-1 text-ink-muted">
            {freshness.reason} If your professor posted a newer one on your course page or emailed it, upload that instead.
          </p>
        </div>
      )}

      {value.missing.length > 0 && (
        <section aria-labelledby="missing-h">
          <h2 id="missing-h" className="font-medium">Not in the syllabus</h2>
          <p className="mt-1 text-sm text-ink-muted">Add these below if you know them, or leave them empty and fill them in later.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {value.missing.map((m) => (
              <li key={m} className="rounded-sm border border-dashed border-ink-muted px-2 py-1 text-sm">{m}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="course-h" className="flex flex-col gap-4">
        <h2 id="course-h" className="font-medium">Course</h2>
        <div className="grid gap-4 sm:grid-cols-[8rem_6rem_1fr]">
          <Field label="Course code" value={value.course_code} onChange={(v) => set("course_code", v)} mono />
          <Field label="Section" value={value.section} onChange={(v) => set("section", v)} mono />
          <Field label="Title" value={value.course_title} onChange={(v) => set("course_title", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instructor" value={value.instructor.name} onChange={(v) => set("instructor", { ...value.instructor, name: v })} />
          <Field label="Instructor email" type="email" value={value.instructor.email} onChange={(v) => set("instructor", { ...value.instructor, email: v })} />
        </div>
      </section>

      <section aria-labelledby="grading-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="grading-h" className="font-medium">Grading</h2>
          <p className={`num text-sm ${value.grading.length && Math.round(total) !== 100 ? "font-medium" : "text-ink-muted"}`}>
            Total {round(total)}%{value.grading.length > 0 && Math.round(total) !== 100 ? " (should be 100%)" : ""}
          </p>
        </div>
        {value.grading.length === 0 && <p className="text-ink-muted">The syllabus doesn&apos;t list grade weights.</p>}
        <div className="divide-y divide-rule border-y border-rule">
          {value.grading.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 py-3 sm:grid-cols-[1fr_6rem_6rem_auto]">
              <div className="col-span-3 sm:col-span-1">
                <Field label="Category" value={c.name} onChange={(v) => setComponent(i, { name: v ?? "" })} />
              </div>
              <NumberField label="Weight %" value={c.weight_percent} onChange={(v) => setComponent(i, { weight_percent: v })} />
              <NumberField label="Drop lowest" value={c.drop_lowest} onChange={(v) => setComponent(i, { drop_lowest: v == null ? null : Math.round(v) })} />
              <RemoveButton label={`Remove ${c.name || "category"}`} onClick={() => set("grading", value.grading.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div>
          <button type="button" className="btn-quiet" onClick={() => set("grading", [...value.grading, { name: "", weight_percent: null, drop_lowest: null, notes: null }])}>
            Add a category
          </button>
        </div>
      </section>

      <section aria-labelledby="items-h" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="items-h" className="font-medium">Exams and due dates</h2>
          {undated > 0 && <p className="text-sm text-ink-muted">{undated} without a date won&apos;t go on your calendar yet.</p>}
        </div>
        <div className="divide-y divide-rule border-y border-rule">
          {value.graded_items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-3 py-3 sm:grid-cols-[1fr_8rem_10.5rem_9.5rem_5rem_auto]">
              <div className="col-span-2 sm:col-span-1">
                <Field label="Title" value={it.title} onChange={(v) => setItem(i, { title: v ?? "" })} />
              </div>
              <label className="flex flex-col gap-1">
                <span className="label">Type</span>
                <select className="input" value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value as Item["kind"] })}>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Date{!it.due_date && <span className="ml-1 font-normal text-ink-muted">(none)</span>}</span>
                <input type="date" className="input num" value={it.due_date ?? ""} onChange={(e) => setItem(i, { due_date: e.target.value || null })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Time</span>
                <input type="time" className="input num" value={it.due_time ?? ""} onChange={(e) => setItem(i, { due_time: e.target.value || null })} />
              </label>
              <NumberField label="Weight %" value={it.weight_percent} onChange={(v) => setItem(i, { weight_percent: v })} />
              <RemoveButton label={`Remove ${it.title || "item"}`} onClick={() => set("graded_items", value.graded_items.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div>
          <button
            type="button"
            className="btn-quiet"
            onClick={() =>
              set("graded_items", [
                ...value.graded_items,
                { title: "", kind: "homework", component: null, due_date: null, due_time: null, weight_percent: null, source_quote: "Added by you" },
              ])
            }
          >
            Add an item
          </button>
        </div>
      </section>

      {value.policies.ai_usage && (
        <section aria-labelledby="ai-h">
          <h2 id="ai-h" className="font-medium">This course&apos;s AI policy</h2>
          <blockquote className="mt-2 border-l-2 border-rule pl-4 text-ink-muted">{value.policies.ai_usage}</blockquote>
        </section>
      )}
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">
        {label}
        {!value && <span className="ml-1 font-normal text-ink-muted">(missing)</span>}
      </span>
      <input type={type} className={`input ${mono ? "num" : ""}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step="any"
        className="input num"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="btn-quiet mb-1">
      Remove
    </button>
  );
}
