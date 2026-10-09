"use server";

import { refresh } from "next/cache";
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
