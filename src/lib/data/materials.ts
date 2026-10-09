import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/**
 * The student's selected files as content blocks for Claude: PDFs and text as documents, photos as images.
 * User-scoped client, so RLS only returns their own documents. Stops adding files past 25 MB in total.
 */
export async function loadMaterialBlocks(supabase: SupabaseClient, documentIds: string[]): Promise<Anthropic.ContentBlockParam[]> {
  if (documentIds.length === 0) return [];
  const { data: docs } = await supabase.from("documents").select("id, filename, mime_type, size_bytes, storage_path").in("id", documentIds);
  const blocks: Anthropic.ContentBlockParam[] = [];
  let total = 0;
  for (const doc of docs ?? []) {
    if (total + doc.size_bytes > MAX_TOTAL_BYTES) break;
    const { data: file } = await supabase.storage.from("documents").download(doc.storage_path);
    if (!file) continue;
    total += doc.size_bytes;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (doc.mime_type === "application/pdf") {
      blocks.push({ type: "document", title: doc.filename, source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } });
    } else if (doc.mime_type.startsWith("text/")) {
      blocks.push({ type: "document", title: doc.filename, source: { type: "text", media_type: "text/plain", data: bytes.toString("utf8") } });
    } else if (doc.mime_type.startsWith("image/")) {
      blocks.push({ type: "image", source: { type: "base64", media_type: doc.mime_type as "image/png" | "image/jpeg" | "image/webp", data: bytes.toString("base64") } });
    }
  }
  return blocks;
}
