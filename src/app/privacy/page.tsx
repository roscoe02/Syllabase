import Link from "next/link";

export const metadata = { title: "Privacy · Syllabase" };

const STORED = [
  ["Your account", "Your email address if you sign in with a link or Google, and your name from Google. Guest accounts have neither."],
  ["Files you upload", "Syllabi, notes, slides, past exams and anything else you add to a course."],
  ["What we read from them", "Course details, grade weights, due dates and policies pulled from your syllabi, which you review before saving."],
  ["Your calendar", "Due dates from your syllabi and, if you connect it, your Canvas calendar. The Canvas link is stored encrypted and never shown again."],
  ["Grades and chats", "Scores you enter in the grade calculator, and your chat conversations."],
  ["Settings and usage", "Your time zone, and how much AI processing you used each day, so we can enforce daily limits."],
] as const;

const PROCESSORS = [
  ["Vercel", "hosts the site and keeps short-lived request logs (like IP addresses) for security and debugging."],
  ["Supabase", "stores your account, data and files."],
  ["Anthropic", "runs Claude, the AI that reads your syllabi and files and answers your questions. Anthropic doesn't train its models on this data."],
  ["Upstash", "counts requests for a few minutes at a time to stop abuse. It stores your account ID or IP address, nothing else."],
] as const;

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Privacy policy</h1>
        <p className="text-ink-muted">Last updated October 9, 2026</p>
        <p>
          Syllabase is a student project. It keeps only what it needs to show your calendar, answer questions about your
          classes and run study tools, and you can delete all of it at any time.
        </p>
      </header>

      <section aria-labelledby="stored-h" className="flex flex-col gap-3">
        <h2 id="stored-h" className="font-medium">What we store</h2>
        <dl className="divide-y divide-rule border-y border-rule">
          {STORED.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
              <dt className="font-medium">{k}</dt>
              <dd className="text-ink-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-ink-muted">
          We don&apos;t sell your data, show ads, or use analytics or tracking tools. The only cookies are the ones that keep you
          signed in.
        </p>
      </section>

      <section aria-labelledby="processors-h" className="flex flex-col gap-3">
        <h2 id="processors-h" className="font-medium">Who handles it</h2>
        <p className="text-ink-muted">These services process your data so Syllabase can work. Nobody else gets it.</p>
        <ul className="flex flex-col gap-2">
          {PROCESSORS.map(([name, what]) => (
            <li key={name}>
              <span className="font-medium">{name}</span> <span className="text-ink-muted">{what}</span>
            </li>
          ))}
        </ul>
        <p className="text-ink-muted">
          When you use the AI features, the relevant files, syllabus details and messages are sent to Anthropic for that
          request only.
        </p>
        <p className="text-ink-muted">
          For UT Dallas courses, Syllabase looks up your professor&apos;s name on Rate My Professors and reads public grade
          records from GitHub. Nothing about you is sent with those lookups.
        </p>
      </section>

      <section aria-labelledby="delete-h" className="flex flex-col gap-3">
        <h2 id="delete-h" className="font-medium">Deleting your data</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-muted">
          <li>
            Remove a course, file or chat whenever you like. <Link href="/settings" className="text-ink underline underline-offset-2">Settings</Link>{" "}
            has &quot;Delete my account&quot;, which erases your account, files, calendar, grades and chats right away.
          </li>
          <li>Guest accounts and everything in them are deleted automatically after 7 days.</li>
          <li>Copies can stay in our providers&apos; backups and logs for a short time before they expire.</li>
        </ul>
      </section>

      <section aria-labelledby="other-h" className="flex flex-col gap-3">
        <h2 id="other-h" className="font-medium">Good to know</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-muted">
          <li>Syllabase is for college students and isn&apos;t meant for anyone under 13.</li>
          <li>It is an independent project, not affiliated with The University of Texas at Dallas or any school.</li>
          <li>If this policy changes, the date at the top changes too.</li>
          <li>
            Questions or requests: open an issue on{" "}
            <a href="https://github.com/roscoe02/Syllabase/issues" className="text-ink underline underline-offset-2">
              GitHub
            </a>
            .
          </li>
        </ul>
      </section>
    </main>
  );
}
