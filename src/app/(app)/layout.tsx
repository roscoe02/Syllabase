import Link from "next/link";
import { signOut } from "./actions";

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/calendar", "Calendar"],
  ["/courses/new", "Add a course"],
  ["/settings", "Settings"],
] as const;

/** Signed-in shell. Static, so it prerenders; each page checks the user inside its own Suspense boundary. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rule">
        <nav aria-label="Main" className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="mr-auto font-semibold">
            Syllabase
          </Link>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink-muted hover:text-ink">
              {label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="text-ink-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
