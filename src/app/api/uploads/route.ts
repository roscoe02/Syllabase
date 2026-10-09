import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { MATERIAL_TYPES } from "@/lib/files";
import { parseBody, requireUser, serverError } from "@/lib/security/request";

/**
 * POST /api/uploads  { filename, size, mimeType, kind, courseId? }
 * Creates the documents row and a one-time signed upload URL. The browser then uploads straight to
 * Supabase Storage (Vercel caps function bodies at ~4.5 MB). Storage itself enforces the 20 MB limit
 * and type allowlist; the parser re-checks the real bytes.
 */

const MAX_BYTES = 20 * 1024 * 1024;
const GUEST_MAX_UPLOADS = 5;

const Body = z.object({
  filename: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_BYTES),
  mimeType: z.enum(MATERIAL_TYPES),
  kind: z.enum(["syllabus", "notes", "slides", "assignment", "rubric", "past_exam", "other"]),
  courseId: z.uuid().optional(),
}).refine((b) => b.kind !== "syllabus" || b.mimeType === "application/pdf", "Syllabi must be PDFs");

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId, isGuest } = auth;

  const limited = await rateLimit("upload", userId);
  if (limited) return limited;

  if (isGuest) {
    const { count } = await supabase.from("documents").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= GUEST_MAX_UPLOADS) {
      return Response.json(
        { error: `Guest accounts can upload ${GUEST_MAX_UPLOADS} files. Sign in with email to add more.` },
        { status: 403 },
      );
    }
  }

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { filename, size, mimeType, kind, courseId } = body.data;

  const id = crypto.randomUUID();
  // Keep names boring: no path tricks, no odd characters in storage keys.
  const safeName = filename.replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "file.pdf";
  const path = `${userId}/${id}/${safeName}`;

  const { error: rowError } = await supabase.from("documents").insert({
    id,
    user_id: userId,
    kind,
    filename: safeName,
    mime_type: mimeType,
    size_bytes: size,
    storage_path: path,
    course_id: courseId ?? null, // RLS (owns_course) rejects someone else's course
  });
  if (rowError) return serverError("uploads insert", rowError);

  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return serverError("uploads sign", error);

  return Response.json({ documentId: id, path, token: data.token });
}
