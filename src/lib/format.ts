/** Display formatting in the student's time zone. */

export function formatDay(instant: string | Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(instant));
}

export function formatTime(instant: string | Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(instant));
}

export function formatKeyLong(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}

/** "Sat, Oct 10" for a date key. */
export function formatKeyDay(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}

export function formatKeyShort(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}

export function formatWeight(w: number | null) {
  return w == null ? null : `${Math.round(w * 10) / 10}%`;
}

export function courseLabel(c: { code: string | null; section?: string | null; title?: string | null } | null) {
  if (!c) return "Other";
  return c.code ?? c.title ?? "Untitled course";
}
