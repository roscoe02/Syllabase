"use server";

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
