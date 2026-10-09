import type { Metadata } from "next";
import { DM_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const ui = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Dates, times, course codes and numbers line up in tabular mono.
const data = DM_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Syllabase",
  description: "Upload your syllabi. Get one calendar, every grade weight, and a study assistant that knows your classes.",
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may set data-theme before React hydrates.
    <html lang="en" className={`${ui.variable} ${data.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies a saved light/dark choice before the first paint, so the page doesn't flash the other theme. */}
        <script>{THEME_SCRIPT}</script>
      </head>
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">
        {children}
        <footer className="mt-auto border-t border-rule px-4 py-6 text-sm text-ink-muted">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2">
            <span>Syllabase is an independent student project, not affiliated with The University of Texas at Dallas.</span>
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-2">Terms</Link>
            <ThemeToggle className="underline underline-offset-2" />
          </div>
        </footer>
      </body>
    </html>
  );
}
