"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => void };
  }
}

/** Cloudflare Turnstile, only when configured (Supabase Auth then requires the token). */
function useTurnstile(container: React.RefObject<HTMLDivElement | null>) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return;
    const el = container.current;
    const render = () => window.turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, callback: setToken });
    if (window.turnstile) return render();
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [container]);
  return token;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaToken = useTurnstile(captchaRef);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=/dashboard`;

  async function oauth(provider: "google" | "azure") {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo(), scopes: provider === "azure" ? "email" : undefined },
    });
    if (error) setStatus({ kind: "error", message: "Couldn't start sign-in. Please try again." });
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setStatus({ kind: "error", message: "Please complete the check above first." });
      return;
    }
    setStatus({ kind: "sending" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(), captchaToken: captchaToken ?? undefined },
    });
    setStatus(
      error
        ? { kind: "error", message: "Couldn't send the link. Check the address and try again in a minute." }
        : { kind: "sent", email },
    );
  }

  /** A temporary account with no email, so anyone can try the app in one click. */
  async function guest() {
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInAnonymously({
      options: { captchaToken: captchaToken ?? undefined },
    });
    if (error) {
      setStatus({ kind: "error", message: "Couldn't start a guest session. Please try again." });
      return;
    }
    router.push("/dashboard");
    router.refresh(); // drop anything cached while signed out
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button type="button" onClick={guest} disabled={status.kind === "sending"} className="btn-primary">
          Try it as a guest
        </button>
        <button type="button" onClick={() => oauth("google")} className="btn-secondary">
          Continue with Google
        </button>
        <button type="button" onClick={() => oauth("azure")} className="btn-secondary">
          Continue with Microsoft
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      {status.kind === "sent" ? (
        <p role="status" className="rounded-md border border-rule p-4">
          Check <span className="font-medium">{status.email}</span> for a sign-in link. You can close this tab.
        </p>
      ) : (
        <form onSubmit={magicLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            School or personal email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          {TURNSTILE_SITE_KEY && <div ref={captchaRef} />}
          <button type="submit" disabled={status.kind === "sending"} className="btn-primary">
            {status.kind === "sending" ? "Sending link" : "Email me a sign-in link"}
          </button>
        </form>
      )}

      <p aria-live="polite" className="text-sm text-ink-muted">
        {status.kind === "error" ? status.message : null}
      </p>
    </div>
  );
}
