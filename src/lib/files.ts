/** File types students can upload as course materials (Storage enforces the same allowlist). */
export const MATERIAL_TYPES = ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** The type to upload a file as: browsers often leave Markdown files untyped. */
export function materialType(file: { name: string; type: string }): MaterialType | null {
  const type = file.type || (/\.(md|markdown)$/i.test(file.name) ? "text/markdown" : /\.txt$/i.test(file.name) ? "text/plain" : "");
  return (MATERIAL_TYPES as readonly string[]).includes(type) ? (type as MaterialType) : null;
}
