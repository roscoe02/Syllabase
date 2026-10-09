"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { materialType, maxBytesFor } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";

const KINDS = [
  ["notes", "Notes"],
  ["slides", "Slides"],
  ["past_exam", "Past exam"],
  ["assignment", "Assignment"],
  ["rubric", "Rubric"],
  ["other", "Other"],
] as const;

/** Upload a study file to this course: straight to Storage with a signed URL, like syllabi. */
export function MaterialsUpload({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("notes");
  const [state, setState] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });

  async function upload(file: File) {
    const mimeType = materialType(file);
    if (!mimeType) return setState({ busy: false, message: "Use a PDF, text or Markdown file, or a photo (PNG, JPEG, WebP)." });
    if (file.size > maxBytesFor(mimeType)) {
      return setState({ busy: false, message: mimeType.startsWith("image/") ? "Photos must be under 5 MB." : "That file is over 20 MB." });
    }
    setState({ busy: true, message: "Uploading" });
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size, mimeType, kind, courseId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setState({ busy: false, message: json.error ?? "Upload failed. Please try again." });
    const { error } = await createClient().storage.from("documents").uploadToSignedUrl(json.path, json.token, file, { contentType: mimeType });
    setState({ busy: false, message: error ? "Upload failed. Please try again." : null });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2">
        <span className="sr-only">Kind of file</span>
        <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={state.busy}>
          {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={`btn-primary cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${state.busy ? "opacity-60" : ""}`}>
        {state.busy ? "Uploading" : "Upload a file"}
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp"
          disabled={state.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </label>
      <p aria-live="polite" className="text-sm text-ink-muted">{state.message}</p>
    </div>
  );
}
