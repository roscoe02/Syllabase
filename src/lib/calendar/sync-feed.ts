import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { decryptSecret } from "@/lib/security/crypto";
import { dateKey, zonedToUtc } from "@/lib/time";
import { fetchFeed, type ImportedEvent } from "./import-ics";
import { type CourseRef, findSyllabusItem, matchCourse, parseCourseCode, type SyllabusItemRef, termFromCode } from "./match";

export interface SyncResult {
  imported: number;
  /** Feed items paired with a syllabus item (they get its grade weight). */
  matched: number;
  /** Syllabus items now hidden behind the feed item that covers them. */
  merged: number;
  newCourses: number;
}

/**
 * Pulls one calendar feed into the student's calendar:
 * 1. matches each item to a course by its code, creating courses the student doesn't have yet (unless they
 *    removed that course before);
 * 2. gives each item the grade weight of its syllabus item, and hides a dated syllabus item behind the feed
 *    item that covers it, so nothing shows twice;
 * 3. upserts the items and drops the ones the feed no longer has.
 * Uses the admin client (it reads the encrypted URL), so every query is filtered by the feed's owner.
 */
export async function syncFeed(admin: SupabaseClient, feedId: string, prefetched?: ImportedEvent[]): Promise<SyncResult> {
  const { data: feed, error: feedError } = await admin
    .from("calendar_feeds")
    .select("id, user_id, url_encrypted, hidden_course_keys")
    .eq("id", feedId)
    .single();
  if (feedError || !feed) throw feedError ?? new Error("feed not found");
  const userId: string = feed.user_id;

  let items: ImportedEvent[];
  try {
    items = prefetched ?? (await fetchFeed(decryptSecret(feed.url_encrypted)));
  } catch (err) {
    await admin
      .from("calendar_feeds")
      .update({ last_error: "Couldn't read the calendar link. It may have changed in Canvas." })
      .eq("id", feedId)
      .eq("user_id", userId);
    throw err;
  }

  const [{ data: profile }, { data: courseRows }, { data: syllabi }, { data: syllabusEvents }] = await Promise.all([
    admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    admin.from("courses").select("id, code, section, canvas_key").eq("user_id", userId),
    admin.from("syllabi").select("course_id, parsed").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("events").select("id, course_id, title, starts_at, weight_percent").eq("user_id", userId).eq("source", "syllabus"),
  ]);
  const tz: string = profile?.timezone ?? "America/Chicago";
  const courses: CourseRef[] = courseRows ?? [];
  const hidden = new Set<string>(feed.hidden_course_keys ?? []);

  // 1. Courses
  let newCourses = 0;
  const courseByKey = new Map<string, string>();
  for (const item of items) {
    const code = parseCourseCode(item.courseCode);
    if (!code || hidden.has(code.key) || courseByKey.has(code.key)) continue;
    let course = matchCourse(courses, code);
    if (!course) {
      const { data, error } = await admin
        .from("courses")
        .insert({
          user_id: userId,
          code: `${code.subjects[0]} ${code.number}`,
          section: code.section,
          term: termFromCode(item.courseCode),
          canvas_key: code.key,
        })
        .select("id, code, section, canvas_key")
        .single();
      if (error) throw error;
      course = data as CourseRef;
      courses.push(course);
      newCourses++;
    } else if (!course.canvas_key) {
      await admin.from("courses").update({ canvas_key: code.key }).eq("id", course.id).eq("user_id", userId);
      course.canvas_key = code.key;
    }
    courseByKey.set(code.key, course.id);
  }

  // 2. Syllabus items per course: dated ones are calendar events; undated ones still carry a weight.
  const latestParsed = new Map<string, ParsedSyllabus>();
  for (const s of syllabi ?? []) if (!latestParsed.has(s.course_id)) latestParsed.set(s.course_id, s.parsed as ParsedSyllabus);
  const syllabusItems = (courseId: string): SyllabusItemRef[] => [
    ...(syllabusEvents ?? [])
      .filter((e) => e.course_id === courseId)
      .map((e) => ({
        title: e.title as string,
        date: dateKey(new Date(e.starts_at), tz),
        weightPercent: e.weight_percent == null ? null : Number(e.weight_percent),
        eventId: e.id as string,
      })),
    ...(latestParsed.get(courseId)?.graded_items ?? [])
      .filter((i) => !i.due_date)
      .map((i) => ({ title: i.title, date: null, weightPercent: i.weight_percent, eventId: null })),
  ];

  // 3. Rows
  let matched = 0;
  const links: Array<{ source_uid: string; syllabus_event_id: string }> = [];
  const rows = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const code = parseCourseCode(item.courseCode);
    if ((code && hidden.has(code.key)) || rows.has(item.sourceUid)) continue;
    const courseId = code ? (courseByKey.get(code.key) ?? null) : null;
    // All-day items sit at local noon, like syllabus items, so they land on the right date in any nearby zone.
    const startsAt = item.allDay && item.date ? zonedToUtc(item.date, "12:00", tz) : item.startsAt;
    const syllabusItem = courseId ? findSyllabusItem(item.title, dateKey(startsAt, tz), syllabusItems(courseId)) : null;
    if (syllabusItem) {
      matched++;
      if (syllabusItem.eventId) links.push({ source_uid: item.sourceUid, syllabus_event_id: syllabusItem.eventId });
    }
    rows.set(item.sourceUid, {
      user_id: userId,
      course_id: courseId,
      feed_id: feedId,
      source: "ics",
      source_uid: item.sourceUid,
      kind: item.kind,
      title: item.title.slice(0, 300),
      description: item.description?.slice(0, 5000) ?? null,
      url: item.url && /^https:\/\//i.test(item.url) ? item.url : null,
      starts_at: startsAt.toISOString(),
      ends_at: item.allDay ? null : (item.endsAt?.toISOString() ?? null),
      all_day: item.allDay,
      weight_percent: syllabusItem?.weightPercent ?? null,
    });
  }

  // 4. Write: upsert current items, drop the ones the feed no longer has, then re-link duplicates.
  if (rows.size) {
    const { error } = await admin.from("events").upsert([...rows.values()], { onConflict: "user_id,source,source_uid" });
    if (error) throw error;
  }
  const { data: existing } = await admin.from("events").select("id, source_uid").eq("user_id", userId).eq("feed_id", feedId);
  const stale = (existing ?? []).filter((e) => !rows.has(e.source_uid)).map((e) => e.id as string);
  if (stale.length) {
    const { error } = await admin.from("events").delete().eq("user_id", userId).in("id", stale);
    if (error) throw error;
  }
  const { error: linkError } = await admin.rpc("link_feed_duplicates", { p_user: userId, p_feed: feedId, p_links: links });
  if (linkError) throw linkError;

  await admin
    .from("calendar_feeds")
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq("id", feedId)
    .eq("user_id", userId);
  return { imported: rows.size, matched, merged: links.length, newCourses };
}

const STALE_AFTER_MS = 60 * 60 * 1000;

/** Re-syncs a student's feeds that haven't synced in the last hour, or all of them with `force`. */
export async function syncStaleFeeds(admin: SupabaseClient, userId: string, { force = false } = {}) {
  const cutoff = new Date(Date.now() - (force ? 0 : STALE_AFTER_MS)).toISOString();
  const { data: feeds } = await admin
    .from("calendar_feeds")
    .select("id")
    .eq("user_id", userId)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`);
  for (const f of feeds ?? []) {
    await syncFeed(admin, f.id).catch((err) => console.error("syncStaleFeeds", err instanceof Error ? err.name : err));
  }
}
