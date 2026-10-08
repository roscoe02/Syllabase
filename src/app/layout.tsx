import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Syllabase",
  description: "Upload your syllabi. Get one calendar, every grade weight, and a study assistant that knows your classes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mt-auto border-t border-rule px-4 py-6 text-sm text-ink-muted">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2">
            <span>Syllabase is an independent student project, not affiliated with The University of Texas at Dallas.</span>
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-2">Terms</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
