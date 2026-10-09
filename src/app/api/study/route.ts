import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, MODELS } from "@/lib/ai/client";
import { checkQuota, recordUsage } from "@/lib/ai/quota";
import { textResponse } from "@/lib/ai/stream";
import { loadCourseContext } from "@/lib/data/chat";
import { loadMaterialBlocks } from "@/lib/data/materials";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { Flashcards, Quiz } from "@/lib/study/outputs";
import { BASE_RULES, getPreset, usesFiles } from "@/lib/study/presets";

/**
 * POST /api/study  { presetId, courseId?, documentIds, focus? }
 * Runs a one-shot study tool on the student's materials. Flashcards and quizzes come back as JSON for their
 * own UI; everything else streams as Markdown. Materials and course facts go in the user turn as reference
 * material, never in the system prompt.
 */

const Body = z.object({
  presetId: z.string().max(40),
  courseId: z.uuid().nullable().optional(),
  documentIds: z.array(z.uuid()).max(5).default([]),
  focus: z.string().trim().max(4000).optional(),
});

const FORMAT = `Write Markdown: headings, short bullet lists and tables where they help. Write math in plain text
(x^2, sqrt(x), a/b), not LaTeX. No intro or outro.`;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId, isGuest } = auth;

  const limited = (await rateLimit("ai", userId)) ?? (await checkQuota(userId, isGuest));
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { presetId, documentIds, focus } = body.data;
  const preset = getPreset(presetId);
  if (!preset || preset.mode !== "one-shot") return Response.json({ error: "Unknown study tool." }, { status: 400 });
  const courseId = body.data.courseId ?? null;

  const [context, materials] = await Promise.all([
    loadCourseContext(supabase, courseId, { withSyllabusFile: false }),
    loadMaterialBlocks(supabase, documentIds),
  ]);
  if (usesFiles(preset) && materials.length === 0 && !focus) {
    return Response.json({ error: "Pick at least one file, or say what to focus on." }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...materials,
    { type: "text", text: `<course_materials>\n${context.text}\n</course_materials>` },
    { type: "text", text: focus ? `Focus on: ${focus}` : "Use the attached materials." },
  ];
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: BASE_RULES },
    { type: "text", text: preset.system },
  ];

  if (preset.output === "flashcards" || preset.output === "quiz") {
    try {
      const response = await anthropic.messages.parse({
        model: MODELS.default,
        max_tokens: 8000,
        system,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(preset.output === "flashcards" ? Flashcards : Quiz) },
      });
      await recordUsage(userId, response.usage);
      if (!response.parsed_output) return Response.json({ error: "Couldn't build that. Try different materials." }, { status: 502 });
      return Response.json({ kind: preset.output, result: response.parsed_output });
    } catch (err) {
      return serverError("study structured", err, "Couldn't build that. Try again.");
    }
  }

  const stream = anthropic.messages.stream({
    model: MODELS.default,
    max_tokens: 8000,
    system: [...system, { type: "text", text: FORMAT }],
    messages: [{ role: "user", content }],
  });
  return textResponse(stream, userId);
}
