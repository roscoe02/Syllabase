"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** One click to a temporary account (Supabase anonymous sign-in) with three sample courses. No email needed. */
export function GuestButton({ captchaToken, className = "btn-primary" }: { captchaToken?: string | null; className?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function start() {
    setState("busy");
    const { error } = await createClient().auth.signInAnonymously({ options: { captchaToken: captchaToken ?? undefined } });
    if (error) {
      setState("error");
      return;
    }
    // Sample courses are a bonus: the account works without them.
    await fetch("/api/guest/seed", { method: "POST" }).catch(() => {});
    router.push("/dashboard");
    router.refresh(); // drop anything cached while signed out
  }

  return (
    <>
      <button type="button" onClick={start} disabled={state === "busy"} className={className}>
        {state === "busy" ? "Setting up a guest account" : "Try it as a guest"}
      </button>
      <p aria-live="polite" className="text-sm text-ink-muted empty:hidden">
        {state === "error" ? "Couldn't start a guest session. Please try again." : null}
      </p>
    </>
  );
}
