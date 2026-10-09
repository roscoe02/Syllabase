import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_IMAGE_BYTES } from "@/lib/files";

// Base64 grows files by a third and the API caps a request at 32 MB, so 20 MB of files in total.
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/**
 * The student's selected files as content blocks for Claude: PDFs and text as documents, photos as images.
 * User-scoped client, so RLS only returns their own documents. Files that would push the total past the cap
 * (or photos over the API's 5 MB) are left out.
 */
export async function loadMaterialBlocks(supabase: SupabaseClient, documentIds: string[]): Promise<Anthropic.ContentBlockParam[]> {
  if (documentIds.length === 0) return [];
  const { data: docs } = await supabase.from("documents").select("id, filename, mime_type, size_bytes, storage_path").in("id", documentIds);
  let total = 0;
  const chosen = (docs ?? []).filter((d) => {
    if (d.mime_type.startsWith("image/") && d.size_bytes > MAX_IMAGE_BYTES) return false;
    if (total + d.size_bytes > MAX_TOTAL_BYTES) return false;
    total += d.size_bytes;
    return true;
  });
  const files = await Promise.all(chosen.map((d) => supabase.storage.from("documents").download(d.storage_path)));

  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const [i, doc] of chosen.entries()) {
    const file = files[i].data;
    if (!file) continue;
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
