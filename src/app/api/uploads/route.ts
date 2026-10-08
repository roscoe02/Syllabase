import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseBody, requireUser, serverError } from "@/lib/security/request";

/**
 * POST /api/uploads  { filename, size, mimeType, kind }
 * Creates the documents row and a one-time signed upload URL. The browser then uploads straight to
 * Supabase Storage (Vercel caps function bodies at ~4.5 MB). Storage itself enforces the 20 MB limit
 * and type allowlist; the parser re-checks the real bytes.
 */

const MAX_BYTES = 20 * 1024 * 1024;

const Body = z.object({
  filename: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_BYTES),
  mimeType: z.enum(["application/pdf"]), // syllabi: PDF only for now
  kind: z.enum(["syllabus"]),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const limited = await rateLimit("upload", userId);
  if (limited) return limited;

  const body = await parseBody(request, Body);
  if ("error" in body) return body.error;
  const { filename, size, mimeType, kind } = body.data;

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
  });
  if (rowError) return serverError("uploads insert", rowError);

  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return serverError("uploads sign", error);

  return Response.json({ documentId: id, path, token: data.token });
}
