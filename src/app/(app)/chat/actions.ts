"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/user";

/** Deletes a conversation and its messages. */
export async function deleteThread(threadId: string) {
  const { supabase } = await getCurrentUser();
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId);
  if (error) console.error("deleteThread failed", { name: error.name });
  redirect("/chat");
}
