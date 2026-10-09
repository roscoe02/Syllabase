import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/client";
import { checkQuota } from "@/lib/ai/quota";
import { textResponse } from "@/lib/ai/stream";
import { loadCourseContext } from "@/lib/data/chat";
import { loadMaterialBlocks } from "@/lib/data/materials";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { BASE_RULES, getPreset, usesFiles } from "@/lib/study/presets";

/**
 * POST /api/chat  { message, threadId?, courseId?, mode? }
 * Streams the course assistant's reply as plain text and saves both turns. A thread can run in a study mode
 * (an interactive preset), which swaps the Q&A rules for the preset's and, for a course, adds its uploaded files. The conversation history comes
 * from the database (never the browser's copy). Course materials lead the first turn as reference material
 * in a cached block, so follow-up questions reuse them cheaply. The thread id is returned in X-Thread-Id.
 */

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.uuid().optional(),
  courseId: z.uuid().nullable().optional(),
  mode: z.string().max(40).optional(),
});

const CHAT_RULES = `You answer questions about the student's courses. Their course materials are in the conversation
inside <course_materials>: parsed syllabus facts, the calendar from their syllabi and Canvas, and the syllabus file when attached.
- Answer from those materials. If they don't say, say so plainly and suggest checking Canvas or asking the professor.
  Never guess a date, weight or policy.
- For dates, use the calendar and today's date from the materials, and give the weekday and date.
- Keep answers short: a few sentences or a short list. Use simple Markdown: "-" lists and **bold** for key dates, no headings.
- When the student asks for help with graded work, mention the course's AI use policy.`;

const MODE_RULES = `The student's course facts and calendar are inside <course_materials>; their uploaded notes, slides
and past exams for the course, if any, come before it. This is a back-and-forth study session: ask one question
at a time and wait for the answer. Write Markdown; write math in plain text (x^2, sqrt(x), a/b), not LaTeX.`;

/** Uploaded files sent with a study mode, newest first. */
const MODE_FILES = 5;

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
  let modeId: string | null;
  if (threadId) {
    const { data: thread } = await supabase.from("chat_threads").select("id, course_id, preset_id").eq("id", threadId).maybeSingle();
    if (!thread) return Response.json({ error: "Chat not found." }, { status: 404 });
    courseId = thread.course_id;
    modeId = thread.preset_id;
  } else {
    courseId = body.data.courseId ?? null;
    modeId = body.data.mode ?? null;
    if (modeId && getPreset(modeId)?.mode !== "interactive") return Response.json({ error: "Unknown study mode." }, { status: 400 });
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, course_id: courseId, preset_id: modeId, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !thread) return serverError("chat new thread", error);
    threadId = thread.id as string;
  }

  const preset = modeId ? getPreset(modeId) : undefined;
  const [{ data: history }, context, files] = await Promise.all([
    supabase.from("chat_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
    loadCourseContext(supabase, courseId),
    preset && usesFiles(preset) && courseId
      ? supabase.from("documents").select("id").eq("course_id", courseId).neq("kind", "syllabus").order("created_at", { ascending: false }).limit(MODE_FILES)
      : Promise.resolve({ data: [] }),
  ]);
  const fileBlocks = await loadMaterialBlocks(supabase, (files.data ?? []).map((d) => d.id));
  const { error: saveError } = await supabase.from("chat_messages").insert({ thread_id: threadId, user_id: userId, role: "user", content: message });
  if (saveError) return serverError("chat save question", saveError);

  const turns: Anthropic.MessageParam[] = [
    ...(history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
    { role: "user", content: message },
  ];
  while (turns[0]?.role === "assistant") turns.shift(); // the history window may start mid-exchange
  const materials: Anthropic.ContentBlockParam[] = [
    ...fileBlocks,
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
    max_tokens: preset ? 4000 : 2000,
    output_config: { effort: "low" },
    system: [
      { type: "text", text: BASE_RULES },
      ...(preset
        ? [{ type: "text" as const, text: preset.system }, { type: "text" as const, text: MODE_RULES }]
        : [{ type: "text" as const, text: CHAT_RULES }]),
    ],
    messages,
  });

  return textResponse(stream, userId, {
    headers: { "X-Thread-Id": threadId },
    onFinish: async (answer, usage) => {
      if (!answer.trim()) return;
      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: answer,
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
      });
    },
  });
}
