import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, lenientFormat, MODELS } from "./client";
import { dropInvalidDates, ExtractedSyllabus, fromExtracted } from "./syllabus-schema";

/** Extraction failed after Claude ran, so the tokens were still billed. */
export class ExtractionError extends Error {
  constructor(message: string, readonly usage: Anthropic.Usage) {
    super(message);
  }
}

const SYSTEM = `You extract structured data from college course syllabi.
Rules:
- Only record what the document states. Never infer a date, weight, or policy that isn't written.
- Resolve relative dates ("Week 5 Tuesday") to ISO dates only when the term start date is given.
- Exams, quizzes and due dates are often only in the course schedule table. Check it for every graded item.
  When a row lists several dates and several topics in the same order, pair them in order
  ("Oct 26, Oct 28 | CWE, Midterm Exam" means the midterm is on Oct 28). If the pairing isn't clear,
  leave the date empty and add the item to "missing" (e.g. "exact midterm date").
- A date written without a year belongs to the term's year (the term the syllabus states, or the one the student selected).
- Put anything a student would expect but cannot find into "missing".
- Keep source_quote short (under 20 words) and verbatim.
- If a text field isn't stated, use an empty string "". If a number isn't stated, use null.`;

/**
 * Turn an uploaded syllabus PDF into structured data.
 * Claude reads PDFs natively (text + page images), so tables of grade weights
 * survive without a separate PDF parser. DOCX should be converted to text
 * (e.g. with mammoth) and sent as a text block instead.
 */
export async function extractSyllabusFromPdf(pdfBase64: string, opts?: { termName?: string; termStart?: string }) {
  const context = [
    opts?.termName && `The student selected the ${opts.termName} term.`,
    opts?.termStart && `The term starts on ${opts.termStart}.`,
  ].filter(Boolean);

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
            text: ["Extract this syllabus.", ...context].join(" "),
          },
        ],
      },
    ],
    output_config: { format: lenientFormat(ExtractedSyllabus) },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new ExtractionError(`Syllabus extraction failed (stop_reason=${response.stop_reason})`, response.usage);
  }
  return { syllabus: dropInvalidDates(fromExtracted(response.parsed_output)), usage: response.usage };
}
