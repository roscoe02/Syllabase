import Link from "next/link";

export const metadata = { title: "Terms · Syllabase" };

const TERMS = [
  [
    "What Syllabase is",
    "A free student project that turns your syllabi and course calendar into one place to plan and study. It is not affiliated with The University of Texas at Dallas or any other school.",
  ],
  [
    "Check what matters",
    "Syllabase uses AI to read syllabi and answer questions, and AI can be wrong. Your official syllabus, Canvas and your professor are the final word on dates, weights and policies. Check anything important there before you rely on it.",
  ],
  [
    "Use it honestly",
    "Use the study tools to learn, not to produce work you submit as your own. Follow each course's rules on AI use.",
  ],
  [
    "Upload only what you may share",
    "Upload your own course materials. Don't upload other people's private information, or files you don't have the right to use.",
  ],
  [
    "Don't misuse it",
    "Don't try to break the site, get into other people's accounts, get around the usage limits or send automated traffic.",
  ],
  ["Age", "You must be at least 13 to use Syllabase."],
  [
    "Your content",
    "What you upload stays yours. You let Syllabase store and process it to run the app, as described in the Privacy Policy, and you can delete it at any time.",
  ],
  [
    "No guarantees",
    "Syllabase is provided as is, without warranties. It may change, have downtime or lose data, so keep your own copies of important files. To the extent the law allows, Syllabase isn't liable for missed deadlines, grades or other losses from using it.",
  ],
  [
    "Changes",
    "Features, limits and these terms may change. If the terms change, the date at the top changes too. Accounts that misuse the site may be removed.",
  ],
] as const;

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Terms of use</h1>
        <p className="text-ink-muted">Last updated October 9, 2026</p>
        <p>By using Syllabase you agree to these terms and the <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.</p>
      </header>
      <dl className="divide-y divide-rule border-y border-rule">
        {TERMS.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-medium">{k}</dt>
            <dd className="text-ink-muted">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-muted">
        Questions: open an issue on{" "}
        <a href="https://github.com/roscoe02/Syllabase/issues" className="text-ink underline underline-offset-2">
          GitHub
        </a>
        .
      </p>
    </main>
  );
}
