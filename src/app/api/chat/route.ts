import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/client";
import { checkQuota, recordUsage } from "@/lib/ai/quota";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser } from "@/lib/security/request";
import { BASE_RULES, getPreset } from "@/lib/study/presets";

/**
 * POST /api/chat — streams a Claude reply as plain text.
 *
 * Body: { messages: [{ role, content: string }], presetId?, courseId? }
 * The client may only send plain-text turns (no raw content blocks, URLs or files), with caps on
 * count and length, so a request can't inject tool calls or run up a huge bill.
 *
 * TODO(context): load the course's parsed syllabus + selected documents (user-scoped client, so RLS
 *   proves ownership of courseId) and put them in a cached block wrapped in <course_materials>.
 * TODO(history): load prior turns from chat_messages by thread id instead of trusting the client's copy.
 */

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(50)
    .refine((m) => m[m.length - 1].role === "user", "Last message must be from the user"),
  presetId: z.string().max(40).optional(),
  courseId: z.uuid().optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { userId, isGuest } = auth;

  const limited = (await rateLimit("ai", userId)) ?? (await checkQuota(userId, isGuest));
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;

  const preset = body.data.presetId ? getPreset(body.data.presetId) : undefined;
  const courseContext = ""; // TODO: buildCourseContext(supabase, body.data.courseId)

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: BASE_RULES },
    ...(preset ? [{ type: "text" as const, text: preset.system }] : []),
    ...(courseContext
      ? [{ type: "text" as const, text: courseContext, cache_control: { type: "ephemeral" as const } }]
      : []),
  ];

  const stream = anthropic.messages.stream({
    model: MODELS.default,
    max_tokens: 8000,
    output_config: { effort: "low" },
    system,
    messages: body.data.messages,
  });

  // Count billed tokens exactly once, whether the reply finishes, fails or the client hangs up.
  let recorded = false;
  const record = async (usage: Anthropic.Usage | undefined) => {
    if (recorded || !usage) return;
    recorded = true;
    await recordUsage(userId, usage);
  };

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        await record((await stream.finalMessage()).usage);
        controller.close();
      } catch (err) {
        await record(stream.currentMessage?.usage);
        console.error("chat stream failed", err instanceof Error ? err.name : err);
        controller.enqueue(encoder.encode("\n\n[Something went wrong. Please try again.]"));
        controller.close();
      }
    },
    async cancel() {
      // Client disconnected: still count what was already billed, so aborting can't dodge the quota.
      const partial = stream.currentMessage;
      stream.abort();
      await record(partial?.usage);
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
