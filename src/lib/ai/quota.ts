import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { billableUsage } from "./pricing";

/**
 * Per-user daily AI budget, enforced on the server before every Claude call.
 * Units are "weighted tokens" (see usage_daily in the migration): roughly cost-proportional,
 * so 1,000,000/day is about $0.10 per user per day on Haiku 5.5.
 */
const DAILY_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 1_000_000);
/** Guests: a few syllabus reads a day. */
const GUEST_DAILY_BUDGET = Number(process.env.GUEST_DAILY_TOKEN_BUDGET ?? 200_000);
/** Everyone together (about $1/day): the backstop if lots of guests show up at once. */
const SITE_DAILY_BUDGET = Number(process.env.SITE_DAILY_TOKEN_BUDGET ?? 10_000_000);

export async function checkQuota(userId: string, isGuest = false): Promise<Response | null> {
  const supabase = createAdminClient();
  const [{ data }, { data: siteTotal }] = await Promise.all([
    supabase
      .from("usage_daily")
      .select("weighted_tokens")
      .eq("user_id", userId)
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
    supabase.rpc("site_usage_today"),
  ]);
  if (Number(siteTotal ?? 0) >= SITE_DAILY_BUDGET) {
    return Response.json({ error: "Syllabase has reached its AI limit for today. Please try again tomorrow." }, { status: 429 });
  }
  if ((data?.weighted_tokens ?? 0) < (isGuest ? GUEST_DAILY_BUDGET : DAILY_BUDGET)) return null;
  return Response.json(
    {
      error: isGuest
        ? "Guest accounts get a few syllabus reads a day. Sign in with email for more."
        : "You've reached today's AI limit. It resets at midnight UTC.",
    },
    { status: 429 },
  );
}

export async function recordUsage(userId: string, usage: Anthropic.Usage) {
  const supabase = createAdminClient();
  const billable = billableUsage({
    input: usage.input_tokens,
    output: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  });
  const { error } = await supabase.rpc("record_usage", {
    p_user: userId,
    p_input: billable.input,
    p_output: billable.output,
    p_cache_read: billable.cacheRead,
    p_cache_write: billable.cacheWrite,
  });
  if (error) console.error("recordUsage failed", { userId, code: error.code });
}
