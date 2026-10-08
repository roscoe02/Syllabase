import { serverError } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserAndFiles } from "@/lib/supabase/delete-user";

const MAX_AGE_DAYS = 7;
const PAGE_SIZE = 1000;

/**
 * GET /api/cron/cleanup-guests — daily Vercel Cron (vercel.json). Deletes guest accounts older than
 * 7 days, with their files. Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else gets a 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  // Collect first, then delete, so deletions don't shift the pages being read.
  const expired: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) return serverError("cron/cleanup-guests list", error);
    for (const u of data.users) if (u.is_anonymous && Date.parse(u.created_at) < cutoff) expired.push(u.id);
    if (data.users.length < PAGE_SIZE) break;
  }

  let failed = 0;
  for (const id of expired) if (await deleteUserAndFiles(id)) failed++;
  if (failed) console.error("cron/cleanup-guests", { failed });
  return Response.json({ deleted: expired.length - failed, failed });
}
