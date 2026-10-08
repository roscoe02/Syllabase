"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { imported: number; matched: number; merged: number; newCourses: number };

/** Paste a Canvas (or other LMS) calendar feed link; shows what the first sync did. */
export function CanvasConnect() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; result: Result } | { kind: "error"; message: string }>({ kind: "idle" });

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    const res = await fetch("/api/feeds/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, provider: "canvas" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState({ kind: "error", message: json.error ?? "Something went wrong. Please try again." });
      return;
    }
    setUrl("");
    setState({ kind: "done", result: json });
    router.refresh();
  }

  return (
    <form onSubmit={connect} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="label">Canvas calendar link</span>
        <input
          type="url"
          required
          inputMode="url"
          autoComplete="off"
          placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input num text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn-primary" disabled={state.kind === "busy"}>
          {state.kind === "busy" ? "Importing" : "Connect"}
        </button>
        <p aria-live="polite" className="text-sm text-ink-muted">
          {state.kind === "error" && state.message}
          {state.kind === "done" &&
            `Imported ${state.result.imported} items` +
              (state.result.newCourses ? `, added ${state.result.newCourses} courses` : "") +
              (state.result.matched ? `, matched ${state.result.matched} to your syllabi` : "") +
              "."}
        </p>
      </div>
    </form>
  );
}
