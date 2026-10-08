import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, MODELS } from "./client";
import { ParsedSyllabus } from "./syllabus-schema";

const SYSTEM = `You extract structured data from college course syllabi.
Rules:
- Only record what the document states. Never infer a date, weight, or policy that isn't written.
- Resolve relative dates ("Week 5 Tuesday") to ISO dates only when the term start date is given.
- Put anything a student would expect but cannot find into "missing".
- Keep source_quote short (under 20 words) and verbatim.`;

/**
 * Turn an uploaded syllabus PDF into structured data.
 * Claude reads PDFs natively (text + page images), so tables of grade weights
 * survive without a separate PDF parser. DOCX should be converted to text
 * (e.g. with mammoth) and sent as a text block instead.
 */
export async function extractSyllabusFromPdf(pdfBase64: string, opts?: { termStart?: string }) {
  const response = await anthropic.messages.parse({
    model: MODELS.default,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          {
            type: "text",
            text: opts?.termStart
              ? `Extract this syllabus. The term starts on ${opts.termStart}.`
              : "Extract this syllabus.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ParsedSyllabus) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Syllabus extraction failed (stop_reason=${response.stop_reason})`);
  }
  return { syllabus: response.parsed_output, usage: response.usage };
}
