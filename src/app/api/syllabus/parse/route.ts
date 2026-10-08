import { z } from "zod";
import { ExtractionError, extractSyllabusFromPdf } from "@/lib/ai/extract-syllabus";
import { checkQuota, recordUsage } from "@/lib/ai/quota";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";
import { checkFreshness } from "@/lib/syllabus/staleness";

/**
 * POST /api/syllabus/parse  { documentId, term?, firstDay? }
 * `term` is a rough window used only for the freshness check. `firstDay` is the real first day of
 * classes, only when the student entered it; it's the only date Claude may use to resolve "Week 5".
 *
 * The browser uploads the PDF straight to Supabase Storage with a signed upload URL
 * (Vercel functions cap request bodies at ~4.5 MB), creates a `documents` row, then calls this.
 * Returns the parsed syllabus plus a freshness verdict for the selected term, for the student to
 * review/edit; nothing is written to the calendar until they confirm. Uploads are the primary path;
 * UTD CourseBook copies go through the same route and freshness check.
 *
 * TODO: DOCX -> text via mammoth; images via vision; CourseBook fetch from Nebula syllabus_uri.
 */

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Body = z.object({
  documentId: z.uuid(),
  term: z.object({ name: z.string().trim().min(1).max(40), start: IsoDate, end: IsoDate }).optional(),
  firstDay: IsoDate.optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const limited = (await rateLimit("ai", userId)) ?? (await checkQuota(userId));
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { documentId, term, firstDay } = body.data;

  // User-scoped client: RLS guarantees this only finds the caller's own document.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return Response.json({ error: "Not found." }, { status: 404 });

  const { data: file, error } = await supabase.storage.from("documents").download(doc.storage_path);
  if (error || !file) return serverError("syllabus/parse download", error);

  // Check the actual bytes, not the file name or the mime type the browser claimed.
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) return Response.json({ error: "File is larger than 20 MB." }, { status: 413 });
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return Response.json({ error: "Only PDF syllabi are supported so far." }, { status: 415 });
  }

  try {
    const { syllabus, usage } = await extractSyllabusFromPdf(bytes.toString("base64"), { termStart: firstDay });
    await recordUsage(userId, usage);
    const freshness = term ? checkFreshness(syllabus, term) : null;
    return Response.json({ syllabus, freshness });
  } catch (err) {
    if (err instanceof ExtractionError) await recordUsage(userId, err.usage);
    return serverError("syllabus/parse extract", err, "We couldn't read that syllabus. Try another file.");
  }
}
