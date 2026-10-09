import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/client";
import { checkQuota, recordUsage } from "@/lib/ai/quota";
import { loadCourseContext } from "@/lib/data/chat";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { BASE_RULES } from "@/lib/study/presets";

/**
 * POST /api/chat  { message, threadId?, courseId? }
 * Streams the course assistant's reply as plain text and saves both turns. The conversation history comes
 * from the database (never the browser's copy). Course materials lead the first turn as reference material
 * in a cached block, so follow-up questions reuse them cheaply. The thread id is returned in X-Thread-Id.
 */

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.uuid().optional(),
  courseId: z.uuid().nullable().optional(),
});

const CHAT_RULES = `You answer questions about the student's courses. Their course materials are in the conversation
inside <course_materials>: parsed syllabus facts, the calendar from their syllabi and Canvas, and the syllabus file when attached.
- Answer from those materials. If they don't say, say so plainly and suggest checking Canvas or asking the professor.
  Never guess a date, weight or policy.
- For dates, use the calendar and today's date from the materials, and give the weekday and date.
- Keep answers short: a few sentences or a short list. Write plain text: no markdown headings, bold or tables; use "-" for lists.
- When the student asks for help with graded work, mention the course's AI use policy.`;

const HISTORY_LIMIT = 20;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId, isGuest } = auth;

  const limited = (await rateLimit("ai", userId)) ?? (await checkQuota(userId, isGuest));
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { message } = body.data;

  // An existing thread keeps its course; a new one is checked by RLS (owns_course) on insert.
  let threadId = body.data.threadId;
  let courseId: string | null;
  if (threadId) {
    const { data: thread } = await supabase.from("chat_threads").select("id, course_id").eq("id", threadId).maybeSingle();
    if (!thread) return Response.json({ error: "Chat not found." }, { status: 404 });
    courseId = thread.course_id;
  } else {
    courseId = body.data.courseId ?? null;
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, course_id: courseId, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !thread) return serverError("chat new thread", error);
    threadId = thread.id as string;
  }

  const [{ data: history }, context] = await Promise.all([
    supabase.from("chat_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
    loadCourseContext(supabase, courseId),
  ]);
  const { error: saveError } = await supabase.from("chat_messages").insert({ thread_id: threadId, user_id: userId, role: "user", content: message });
  if (saveError) return serverError("chat save question", saveError);

  const turns: Anthropic.MessageParam[] = [
    ...(history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
    { role: "user", content: message },
  ];
  while (turns[0]?.role === "assistant") turns.shift(); // the history window may start mid-exchange
  const materials: Anthropic.ContentBlockParam[] = [
    ...(context.pdf
      ? [{ type: "document" as const, title: "Syllabus", source: { type: "base64" as const, media_type: "application/pdf" as const, data: context.pdf } }]
      : []),
    { type: "text", text: `<course_materials>\n${context.text}\n</course_materials>`, cache_control: { type: "ephemeral" } },
  ];
  const messages = turns.map((t, i) =>
    i === 0 ? { role: "user" as const, content: [...materials, { type: "text" as const, text: String(t.content) }] } : t,
  );

  const stream = anthropic.messages.stream({
    model: MODELS.default,
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: [{ type: "text", text: BASE_RULES }, { type: "text", text: CHAT_RULES }],
    messages,
  });

  // Count billed tokens exactly once, whether the reply finishes, fails or the client hangs up.
  let recorded = false;
  const record = async (usage: Anthropic.Usage | undefined) => {
    if (recorded || !usage) return;
    recorded = true;
    await recordUsage(userId, usage);
  };
  let answer = "";
  const saveAnswer = async (usage: Anthropic.Usage | undefined) => {
    if (!answer.trim()) return;
    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      content: answer,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
    });
  };

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const { usage } = await stream.finalMessage();
        await Promise.all([record(usage), saveAnswer(usage)]);
        controller.close();
      } catch (err) {
        await record(stream.currentMessage?.usage);
        console.error("chat stream failed", err instanceof Error ? err.name : err);
        controller.enqueue(encoder.encode("\n\n[Something went wrong. Please try again.]"));
        controller.close();
      }
    },
    async cancel() {
      const partial = stream.currentMessage;
      stream.abort();
      await Promise.all([record(partial?.usage), saveAnswer(partial?.usage)]);
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Thread-Id": threadId },
  });
}
