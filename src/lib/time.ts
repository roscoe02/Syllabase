/**
 * Time zone helpers with no dependencies (Intl only). Students' dates are wall-clock times in their
 * school's time zone (profiles.timezone); the database stores UTC.
 */

/** Offset of `tz` from UTC at the given instant, in minutes (e.g. -300 for CDT). */
function offsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-10-14" + "23:59" in America/Chicago -> the matching UTC instant. Handles DST. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes so times right after a DST change land on the correct offset.
  let utc = guess - offsetMinutes(new Date(guess), tz) * 60000;
  utc = guess - offsetMinutes(new Date(utc), tz) * 60000;
  return new Date(utc);
}

/** The calendar date ("YYYY-MM-DD") an instant falls on in `tz`. */
export function dateKey(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** "2026-10-14" -> "2026-10-12" (the Monday of that week). Pure date math, no time zone. */
export function mondayOfKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
