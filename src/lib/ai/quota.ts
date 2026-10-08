import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-user daily AI budget, enforced on the server before every Claude call.
 * Units are "weighted tokens" (see usage_daily in the migration): roughly cost-proportional,
 * so 1,000,000/day is about $0.10 per user per day on Haiku 5.5.
 */
const DAILY_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 1_000_000);

export async function checkQuota(userId: string): Promise<Response | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("usage_daily")
    .select("weighted_tokens")
    .eq("user_id", userId)
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  if ((data?.weighted_tokens ?? 0) < DAILY_BUDGET) return null;
  return Response.json(
    { error: "You've reached today's AI limit. It resets at midnight UTC." },
    { status: 429 },
  );
}

export async function recordUsage(userId: string, usage: Anthropic.Usage) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("record_usage", {
    p_user: userId,
    p_input: usage.input_tokens,
    p_output: usage.output_tokens,
    p_cache_read: usage.cache_read_input_tokens ?? 0,
    p_cache_write: usage.cache_creation_input_tokens ?? 0,
  });
  if (error) console.error("recordUsage failed", { userId, code: error.code });
}
