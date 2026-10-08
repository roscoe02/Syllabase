import "server-only";
import ical, { type VEvent, type ParameterValue } from "node-ical";
import { safeFetchText } from "@/lib/security/safe-fetch";

/**
 * Import a Canvas / Blackboard / D2L / Moodle / Google calendar feed.
 *
 * Feeds must be fetched server-side: LMSes don't send CORS headers, and the feed URL is a
 * bearer secret (anyone holding it can read the student's schedule), so it never goes back
 * to the browser and is never logged.
 *
 * Canvas specifics (from canvas-lms source):
 *  - SUMMARY is "<title> [<course_code>]", e.g. "HW 3 [CS 3345.001]" — used to match courses
 *  - UID is "event-assignment-<id>" / "event-calendar-event-<id>" — stable, used for dedupe
 *  - window is ~30 days back to ~1 year ahead; regenerated on every request
 */

export interface ImportedEvent {
  sourceUid: string;
  title: string;
  /** Course code pulled from a trailing "[...]" in the title, if present. */
  courseCode: string | null;
  description: string | null;
  url: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  /** Guessed from the UID/title; the user can correct it. */
  kind: "homework" | "exam" | "quiz" | "other";
}

const text = (v: ParameterValue | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.val;

const COURSE_SUFFIX = /\s*\[([^\]]+)\]\s*$/;

function guessKind(uid: string, title: string): ImportedEvent["kind"] {
  if (/\b(exam|midterm|final)\b/i.test(title)) return "exam";
  if (/\bquiz\b/i.test(title)) return "quiz";
  if (uid.startsWith("event-assignment-")) return "homework";
  return "other";
}

export async function fetchFeed(feedUrl: string): Promise<ImportedEvent[]> {
  const url = feedUrl.replace(/^webcal:\/\//i, "https://");
  // https only, public hosts only, 5 MB cap: the URL is user-supplied (see safe-fetch.ts).
  const body = await safeFetchText(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 15_000 });
  const parsed = ical.sync.parseICS(body);

  const events: ImportedEvent[] = [];
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    const rawTitle = text(ev.summary) ?? "(untitled)";
    const match = rawTitle.match(COURSE_SUFFIX);
    events.push({
      sourceUid: ev.uid,
      title: match ? rawTitle.replace(COURSE_SUFFIX, "") : rawTitle,
      courseCode: match?.[1] ?? null,
      description: text(ev.description),
      url: typeof ev.url === "string" ? ev.url : null,
      startsAt: ev.start,
      endsAt: ev.end ?? null,
      allDay: ev.datetype === "date",
      kind: guessKind(ev.uid, rawTitle),
    });
    // TODO: expand RRULE recurrences (node-ical exposes ev.rrule) for non-LMS feeds.
  }
  return events;
}
