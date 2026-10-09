/** File types students can upload as course materials (Storage enforces the same allowlist). */
export const MATERIAL_TYPES = ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** The type to upload a file as: browsers often leave Markdown files untyped. */
export function materialType(file: { name: string; type: string }): MaterialType | null {
  const type = file.type || (/\.(md|markdown)$/i.test(file.name) ? "text/markdown" : /\.txt$/i.test(file.name) ? "text/plain" : "");
  return (MATERIAL_TYPES as readonly string[]).includes(type) ? (type as MaterialType) : null;
}

/** Upload limits: 20 MB per file, 5 MB for photos (the most Claude accepts per image). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const maxBytesFor = (type: string) => (type.startsWith("image/") ? MAX_IMAGE_BYTES : MAX_FILE_BYTES);
