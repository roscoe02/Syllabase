import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Single shared Anthropic client. Reads ANTHROPIC_API_KEY from the environment.
 * Never import this from a client component — the key must stay server-side.
 */
export const anthropic = new Anthropic();

/**
 * Model routing. Haiku 5.5 is the default for everything: $0.10 / $0.50 per
 * million input/output tokens for prompts up to 100K tokens ($0.50 / $2.50
 * above that), 1M context. Keep per-request prompts under 100K tokens to stay
 * on the cheap rate card. Promote a route to Sonnet only if evals show Haiku
 * isn't good enough for it.
 *
 * Haiku 5.5 notes: thinking is adaptive and on by default (control it with
 * output_config.effort; default "medium"), temperature/top_p/top_k must be
 * omitted, and assistant prefill is rejected — use structured outputs instead.
 */
export const MODELS = {
  default: "claude-haiku-5-5",
  /** Escalation for hard extraction (e.g. scanned, table-heavy syllabi). */
  strong: "claude-sonnet-5-5",
} as const;

/**
 * zodOutputFormat whose check returns null instead of throwing, so a reply that doesn't match the schema still
 * comes back with its usage (already billed) for the caller to record.
 */
export function lenientFormat<S extends Parameters<typeof zodOutputFormat>[0]>(schema: S) {
  const format = zodOutputFormat(schema);
  return {
    ...format,
    parse: (content: string) => {
      try {
        return format.parse(content);
      } catch {
        return null;
      }
    },
  };
}
