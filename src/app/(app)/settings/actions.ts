"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { syncFeed } from "@/lib/calendar/sync-feed";
import { deleteCourses } from "@/lib/data/courses";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserAndFiles } from "@/lib/supabase/delete-user";
import { getCurrentUser } from "@/lib/data/user";

/** New calendar link; the old one stops working right away. */
export async function regenerateIcsToken() {
  const { supabase } = await getCurrentUser();
  await supabase.rpc("regenerate_ics_token");
  refresh();
}

export async function updateTimezone(formData: FormData) {
  const tz = String(formData.get("timezone") ?? "");
  if (!Intl.supportedValuesOf("timeZone").includes(tz)) return;
  const { supabase, id } = await getCurrentUser();
  await supabase.from("profiles").update({ timezone: tz }).eq("id", id);
  refresh();
}

/** Re-syncs one of the student's calendar feeds now. */
export async function syncFeedNow(feedId: string) {
  const { supabase } = await getCurrentUser();
  // User-scoped lookup first: RLS proves the feed is theirs before the admin client touches it.
  const { data: feed } = await supabase.from("calendar_feeds").select("id").eq("id", feedId).maybeSingle();
  if (!feed) return;
  await syncFeed(createAdminClient(), feed.id).catch((err) => console.error("syncFeedNow", err instanceof Error ? err.name : err));
  refresh();
}

/** Disconnects a feed; its items leave the calendar and any syllabus items they covered come back. */
export async function disconnectFeed(feedId: string) {
  const { supabase } = await getCurrentUser();
  const { error } = await supabase.from("calendar_feeds").delete().eq("id", feedId);
  if (error) console.error("disconnectFeed failed", { name: error.name });
  refresh();
}

/** Removes every course, calendar item and uploaded syllabus. The account and settings stay. */
export async function deleteAllCourses() {
  const { supabase, id } = await getCurrentUser();
  const error = await deleteCourses(supabase, id);
  if (error) console.error("deleteAllCourses failed", { name: error.name });
  refresh();
}

/**
 * Permanently deletes the account: uploaded files first (Storage doesn't cascade), then the auth
 * user, which cascades to every table. Requires typing "delete" so it can't happen by accident.
 */
export async function deleteAccount(formData: FormData) {
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") return;
  const { supabase, id } = await getCurrentUser();
  const error = await deleteUserAndFiles(id);
  if (error) {
    console.error("deleteAccount failed", { code: error.code });
    return;
  }
  await supabase.auth.signOut().catch(() => {});
  redirect("/?deleted=1");
}
