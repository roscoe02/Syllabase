import { z } from "zod";
import { formatDay, formatTime } from "@/lib/format";

/**
 * Quick add: the student describes a change in plain words, Claude proposes calendar changes, and nothing is
 * saved until the student confirms. Claude refers to courses and events by short refs (c1, e4) that the server
 * maps back to ids, so it can't point at rows it wasn't shown.
 */

export const KINDS = ["exam", "quiz", "homework", "project", "paper", "lab", "reading", "class", "office_hours", "other"] as const;
export const MAX_CHANGES = 40;
/** The chat mode that edits the calendar instead of starting a saved conversation. */
export const CALENDAR_MODE = "calendar";

/** What Claude returns. Text fields use "" for "none" to stay within the structured-output limits. */
export const QuickAddOutput = z.object({
  reply: z.string(),
  changes: z.array(
    z.object({
      action: z.enum(["add", "move", "remove"]),
      event: z.string(),
      course: z.string(),
      title: z.string(),
      date: z.string(),
      time: z.string(),
      kind: z.enum(KINDS),
      weight_percent: z.number().nullable(),
    }),
  ),
});
export type QuickAddOutput = z.infer<typeof QuickAddOutput>;

/** A checked change, sent to the browser for review and back to the server to save. */
export const Change = z.object({
  action: z.enum(["add", "move", "remove"]),
  eventId: z.uuid().nullable(),
  courseId: z.uuid().nullable(),
  courseLabel: z.string().max(40).nullable(),
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  kind: z.enum(KINDS),
  weightPercent: z.number().min(0).max(100).nullable(),
});
export type Change = z.infer<typeof Change>;

export interface RefCourse {
  ref: string;
  id: string;
  label: string;
}
export interface RefEvent {
  ref: string;
  id: string;
  title: string;
  kind: string;
  courseId: string | null;
  editable: boolean;
}

const realDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);

/** Claude's proposal -> changes the server will accept. Anything that doesn't check out is dropped. */
export function resolveChanges(out: QuickAddOutput, courses: RefCourse[], events: RefEvent[], defaultCourseId: string | null): Change[] {
  const label = (id: string | null) => courses.find((c) => c.id === id)?.label ?? null;
  const changes: Change[] = [];
  for (const c of out.changes.slice(0, MAX_CHANGES)) {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time) ? c.time : null;
    const weight = c.weight_percent != null && c.weight_percent >= 0 && c.weight_percent <= 100 ? c.weight_percent : null;
    if (c.action === "add") {
      const title = c.title.trim().slice(0, 200);
      if (!title || !realDate(c.date)) continue;
      const courseId = courses.find((x) => x.ref === c.course)?.id ?? defaultCourseId;
      changes.push({ action: "add", eventId: null, courseId, courseLabel: label(courseId), title, date: c.date, time, kind: c.kind, weightPercent: weight });
      continue;
    }
    const ev = events.find((e) => e.ref === c.event);
    if (!ev?.editable) continue;
    if (c.action === "move" && !realDate(c.date)) continue;
    changes.push({
      action: c.action,
      eventId: ev.id,
      courseId: ev.courseId,
      courseLabel: label(ev.courseId),
      title: ev.title,
      date: c.action === "move" ? c.date : null,
      time: c.action === "move" ? time : null,
      kind: KINDS.includes(ev.kind as Change["kind"]) ? (ev.kind as Change["kind"]) : "other",
      weightPercent: null,
    });
  }
  return changes;
}

/** "Fri, Oct 16, 10:00 AM" or "Fri, Oct 16" for all-day items. */
export function describeWhen(date: string, time: string | null) {
  const day = formatDay(`${date}T12:00:00Z`, "UTC");
  return time ? `${day}, ${formatTime(`1970-01-01T${time}:00Z`, "UTC")}` : day;
}
