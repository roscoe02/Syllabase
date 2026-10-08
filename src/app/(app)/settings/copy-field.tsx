"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="copy-field" className="label">{label}</label>
      <div className="flex gap-2">
        <input id="copy-field" readOnly value={value} className="input num text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">{copied ? "Link copied" : ""}</span>
    </div>
  );
}
