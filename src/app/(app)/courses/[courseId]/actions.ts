"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { deleteCourses } from "@/lib/data/courses";
import { getCurrentUser } from "@/lib/data/user";

/** Removes the course, its calendar items, syllabi and uploaded files. */
export async function deleteCourse(courseId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return;
  const { supabase, id } = await getCurrentUser();
  const error = await deleteCourses(supabase, id, courseId);
  if (error) {
    console.error("deleteCourse failed", { name: error.name });
    return;
  }
  redirect("/dashboard");
}

/** Removes one uploaded file (Storage first, since it doesn't cascade). */
export async function removeDocument(documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return;
  const { supabase } = await getCurrentUser();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return;
  const { error } = await supabase.storage.from("documents").remove([doc.storage_path]);
  if (!error) await supabase.from("documents").delete().eq("id", documentId);
  else console.error("removeDocument failed", { name: error.name });
  refresh();
}

const UUID = /^[0-9a-f-]{36}$/i;
const Score = z.object({
  component: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  earned: z.coerce.number().min(0).max(100_000),
  possible: z.coerce.number().positive().max(100_000),
});

/** Saves a score the student got back. RLS (owns_course) rejects someone else's course. */
export async function addGradeEntry(courseId: string, formData: FormData) {
  const parsed = Score.safeParse(Object.fromEntries(formData));
  if (!UUID.test(courseId) || !parsed.success) return;
  const { supabase, id } = await getCurrentUser();
  const { component, title, earned, possible } = parsed.data;
  const { error } = await supabase.from("grade_entries").insert({ user_id: id, course_id: courseId, component, title: title || null, earned, possible });
  if (error) console.error("addGradeEntry failed", { name: error.name });
  refresh();
}

export async function removeGradeEntry(entryId: string) {
  if (!UUID.test(entryId)) return;
  const { supabase } = await getCurrentUser();
  await supabase.from("grade_entries").delete().eq("id", entryId);
  refresh();
}

/** A weight the syllabus didn't give, entered by the student. Results that use it are marked as estimates. */
export async function setWeightGuess(courseId: string, component: string, formData: FormData) {
  const weight = z.coerce.number().min(0).max(100).safeParse(formData.get("weight"));
  if (!UUID.test(courseId) || !weight.success || component.length > 120) return;
  const { supabase, id } = await getCurrentUser();
  const { error } = await supabase
    .from("grade_weights")
    .upsert({ course_id: courseId, user_id: id, component, weight_percent: weight.data, is_guess: true, drop_lowest: 0 });
  if (error) console.error("setWeightGuess failed", { name: error.name });
  refresh();
}
