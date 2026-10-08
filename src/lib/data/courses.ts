import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes one course, or every course when `courseId` is omitted, with its uploaded files. Events, syllabi
 * and grades cascade in the database; Storage files don't, so they go first. A removed course that came from
 * a calendar feed is remembered on the feed, so the next sync doesn't bring it back; removing every course
 * disconnects the feeds too. Runs with the user-scoped client, so RLS limits it to the student's own data.
 * Returns the first error, if any.
 */
export async function deleteCourses(supabase: SupabaseClient, userId: string, courseId?: string) {
  if (courseId) {
    const { data: course } = await supabase.from("courses").select("canvas_key").eq("id", courseId).maybeSingle();
    if (course?.canvas_key) {
      const { data: feeds } = await supabase.from("calendar_feeds").select("id, hidden_course_keys").eq("user_id", userId);
      for (const f of feeds ?? []) {
        const keys: string[] = f.hidden_course_keys ?? [];
        if (keys.includes(course.canvas_key)) continue;
        const { error } = await supabase.from("calendar_feeds").update({ hidden_course_keys: [...keys, course.canvas_key] }).eq("id", f.id);
        if (error) return error;
      }
    }
  } else {
    const { error } = await supabase.from("calendar_feeds").delete().eq("user_id", userId);
    if (error) return error;
  }

  let docsQuery = supabase.from("documents").select("storage_path").eq("user_id", userId);
  if (courseId) docsQuery = docsQuery.eq("course_id", courseId);
  const { data: docs, error: docsError } = await docsQuery;
  if (docsError) return docsError;
  const paths = (docs ?? []).map((d) => d.storage_path as string);
  if (paths.length) {
    const { error } = await supabase.storage.from("documents").remove(paths);
    if (error) return error;
  }

  let docRows = supabase.from("documents").delete().eq("user_id", userId);
  if (courseId) docRows = docRows.eq("course_id", courseId);
  const { error: docRowsError } = await docRows;
  if (docRowsError) return docRowsError;

  let courses = supabase.from("courses").delete().eq("user_id", userId);
  if (courseId) courses = courses.eq("id", courseId);
  const { error: coursesError } = await courses;
  if (coursesError) return coursesError;

  if (!courseId) {
    // "Remove all" clears the calendar too, including items that don't belong to a course.
    const { error } = await supabase.from("events").delete().eq("user_id", userId);
    if (error) return error;
  }
  return null;
}
