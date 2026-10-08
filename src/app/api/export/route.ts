import { requireUser } from "@/lib/security/request";

/**
 * GET /api/export — everything we store about the signed-in student, as JSON (COMPLIANCE: export my data).
 * User-scoped client, so RLS limits every table to their rows. Feed URLs aren't readable by design.
 */
const TABLES = {
  profile: ["profiles", "display_name, school, timezone, learning_profile, digest_enabled, created_at"],
  courses: ["courses", "id, code, section, title, term, instructor_name, instructor_email, created_at"],
  documents: ["documents", "id, course_id, kind, filename, mime_type, size_bytes, status, created_at"],
  syllabi: ["syllabi", "id, course_id, document_id, source, freshness, parsed, model, created_at"],
  events: ["events", "id, course_id, source, kind, title, description, starts_at, ends_at, all_day, weight_percent, url, created_at"],
  calendar_feeds: ["calendar_feeds", "id, provider, label, last_synced_at, created_at"],
  grade_weights: ["grade_weights", "course_id, component, weight_percent, is_guess, drop_lowest"],
  grade_entries: ["grade_entries", "id, course_id, event_id, component, title, earned, possible, created_at"],
  chat_threads: ["chat_threads", "id, course_id, preset_id, title, created_at"],
  chat_messages: ["chat_messages", "id, thread_id, role, content, created_at"],
  usage_daily: ["usage_daily", "day, input_tokens, output_tokens"],
} as const;

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const results = await Promise.all(
    Object.entries(TABLES).map(async ([key, [table, columns]]) => {
      const { data } = await auth.supabase.from(table).select(columns);
      return [key, data ?? []] as const;
    }),
  );
  const out = { exported_at: new Date().toISOString(), ...Object.fromEntries(results) };
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="syllabase-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
