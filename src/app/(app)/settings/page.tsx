import { headers } from "next/headers";
import { Suspense } from "react";
import { getProfile } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/data/user";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDay, formatTime } from "@/lib/format";
import { deleteAccount, deleteAllCourses, disconnectFeed, regenerateIcsToken, syncFeedNow, updateTimezone } from "./actions";
import { CanvasConnect } from "./canvas-connect";
import { CanvasHowTo } from "./canvas-how-to";
import { CopyField } from "./copy-field";

export const metadata = { title: "Settings · Syllabase" };

const COMMON_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

export default function SettingsPage() {
  return (
    <main id="main" className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<div className="skeleton h-64 w-full max-w-2xl" aria-busy="true" aria-label="Loading settings" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

async function Settings() {
  const { supabase, email } = await getCurrentUser();
  const [{ timezone, icsToken }, base, { data: feeds }] = await Promise.all([
    getProfile(supabase),
    siteUrl(),
    supabase.from("calendar_feeds").select("id, provider, last_synced_at, last_error, created_at").order("created_at"),
  ]);
  const feedUrl = `${base}/api/calendar/${icsToken}.ics`;
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const zones = COMMON_ZONES.includes(timezone) ? COMMON_ZONES : [timezone, ...COMMON_ZONES];

  return (
    <div className="flex max-w-2xl flex-col gap-12">
      <section id="canvas" aria-labelledby="canvas-h" className="flex flex-col gap-4">
        <div>
          <h2 id="canvas-h" className="font-medium">Canvas calendar</h2>
          <p className="mt-1 text-ink-muted">
            Bring in every due date from Canvas. Items are matched to your courses, and anything that&apos;s also in a
            syllabus shows once, with Canvas&apos;s due time and the syllabus&apos;s grade weight. It updates daily.
          </p>
        </div>
        <CanvasHowTo />
        {(feeds ?? []).length > 0 && (
          <ul className="divide-y divide-rule border-y border-rule">
            {(feeds ?? []).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="mr-auto flex flex-col">
                  <span className="font-medium capitalize">{f.provider} calendar</span>
                  <span className="text-sm text-ink-muted">
                    {f.last_error
                      ? f.last_error
                      : f.last_synced_at
                        ? `Last synced ${formatDay(f.last_synced_at, timezone)}, ${formatTime(f.last_synced_at, timezone)}`
                        : "Not synced yet"}
                  </span>
                </div>
                <form action={syncFeedNow.bind(null, f.id)}>
                  <button type="submit" className="btn-secondary">Sync now</button>
                </form>
                <form action={disconnectFeed.bind(null, f.id)}>
                  <ConfirmSubmit message="Disconnect this calendar? Its items leave your calendar." className="btn-quiet">
                    Disconnect
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        <CanvasConnect />
        <p className="text-sm text-ink-muted">The link is private. Syllabase stores it encrypted and never shows it again.</p>
      </section>

      <section id="calendar-export" aria-labelledby="export-h" className="flex flex-col gap-4">
        <div>
          <h2 id="export-h" className="font-medium">Your calendar in Google, Apple or Outlook</h2>
          <p className="mt-1 text-ink-muted">
            Subscribe once and new deadlines show up on their own. Google checks for changes every 12 to 24 hours; Apple is faster.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={google} target="_blank" rel="noopener noreferrer" className="btn-primary">Add to Google Calendar</a>
          <a href={webcal} className="btn-secondary">Add to Apple or Outlook</a>
        </div>
        <CopyField label="Or copy the link" value={feedUrl} />
        <p className="text-sm text-ink-muted">Anyone with this link can see your deadlines. If it leaks, make a new one.</p>
        <form action={regenerateIcsToken}>
          <button type="submit" className="btn-quiet px-0">Make a new link (the old one stops working)</button>
        </form>
      </section>

      <section aria-labelledby="tz-h" className="flex flex-col gap-3">
        <h2 id="tz-h" className="font-medium">Time zone</h2>
        <form action={updateTimezone} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="label">Deadlines are shown in</span>
            <select name="timezone" defaultValue={timezone} className="input">
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-secondary">Save</button>
        </form>
      </section>

      <section aria-labelledby="data-h" className="flex flex-col gap-3">
        <h2 id="data-h" className="font-medium">Your data</h2>
        <p className="text-ink-muted">
          {email ? `Signed in as ${email}.` : "Signed in as a guest. Guest accounts and their data are deleted after 7 days."}
        </p>
        <div>
          <a href="/api/export" className="btn-secondary">Download my data</a>
        </div>
      </section>

      <section aria-labelledby="clear-h" className="flex flex-col gap-3 border-t border-rule pt-8">
        <h2 id="clear-h" className="font-medium">Remove all courses</h2>
        <p className="text-ink-muted">
          Clears every course, calendar item and uploaded syllabus, and disconnects Canvas. Your account and settings stay.
        </p>
        <form action={deleteAllCourses}>
          <ConfirmSubmit message="Remove all your courses and calendar items? This can't be undone." className="btn-secondary">
            Remove all courses
          </ConfirmSubmit>
        </form>
      </section>

      <section aria-labelledby="delete-h" className="flex flex-col gap-3 border-t border-rule pt-8">
        <h2 id="delete-h" className="font-medium">Delete account</h2>
        <p className="text-ink-muted">Deletes your courses, uploads, calendar and chats right away. This can&apos;t be undone.</p>
        <form action={deleteAccount} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="label">Type &quot;delete&quot; to confirm</span>
            <input name="confirm" required autoComplete="off" className="input w-48" />
          </label>
          <button type="submit" className="btn-secondary">Delete my account</button>
        </form>
      </section>
    </div>
  );
}
