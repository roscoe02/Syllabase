import Link from "next/link";

// Placeholder landing page. The real one shows a sample syllabus turning into a calendar.
const FEATURES = [
  ["Syllabus to calendar", "Upload each syllabus once. Exams, due dates, grade weights and policies land in one calendar."],
  ["Canvas and Blackboard sync", "Paste your LMS calendar link and new assignments show up on their own."],
  ["Ask about your classes", "Chat with an assistant that has read your syllabi, notes and assignment prompts."],
  ["Study tools", "Cheat sheets, quizzes, flashcards, an exam predictor and a semester planner, built from your own material."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold">Syllabase</h1>
        <p className="text-lg text-ink-muted">
          Your syllabi, deadlines and course materials in one place, with a study assistant that knows your classes.
        </p>
        <div>
          <Link href="/login" className="inline-block rounded-md bg-ink px-5 py-2 font-medium text-paper">
            Sign in
          </Link>
        </div>
      </header>
      <dl className="divide-y divide-rule border-y border-rule">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <dt className="font-medium">{title}</dt>
            <dd className="text-ink-muted">{body}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
