import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Syllabase" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-24">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in to Syllabase</h1>
        <p className="text-ink-muted">Your syllabi, uploads and calendar are saved to your account.</p>
      </header>
      <LoginForm />
      <p className="text-sm text-ink-muted">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
      </p>
    </main>
  );
}
