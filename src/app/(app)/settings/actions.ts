"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Permanently deletes the account: uploaded files first (Storage doesn't cascade), then the auth
 * user, which cascades to every table. Requires typing "delete" so it can't happen by accident.
 */
export async function deleteAccount(formData: FormData) {
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") return;
  const { supabase, id } = await getCurrentUser();
  const admin = createAdminClient();

  const bucket = admin.storage.from("documents");
  const { data: folders } = await bucket.list(id, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${id}/${folder.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${id}/${folder.name}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("deleteAccount failed", { code: error.code });
    return;
  }
  await supabase.auth.signOut().catch(() => {});
  redirect("/?deleted=1");
}
