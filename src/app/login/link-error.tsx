"use client";

import { useSearchParams } from "next/navigation";

/** Shown when an email sign-in link fails (/auth/callback and /auth/confirm send people here with ?error=link). */
export function LinkError() {
  if (useSearchParams().get("error") !== "link") return null;
  return (
    <p role="alert" className="rounded-md border border-rule p-4 text-sm">
      That sign-in link didn&apos;t work or has expired. Request a new one below.
    </p>
  );
}
