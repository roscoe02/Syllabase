import "server-only";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared guards for route handlers: verify the user on the server (never trust a user id
 * from the client) and validate the JSON body against an allowlist schema, so unexpected
 * fields (role, user_id, ...) are dropped and bad types are rejected.
 */

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: Response.json({ error: "Please sign in." }, { status: 401 }) } as const;
  return { supabase, userId } as const;
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T, maxBytes = 64 * 1024) {
  let json: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return { error: Response.json({ error: "Request too large." }, { status: 413 }) } as const;
    json = JSON.parse(text);
  } catch {
    return { error: Response.json({ error: "Invalid request." }, { status: 400 }) } as const;
  }
  const result = schema.safeParse(json);
  if (!result.success) return { error: Response.json({ error: "Invalid request." }, { status: 400 }) } as const;
  return { data: result.data as z.infer<T> } as const;
}

/** Log the real error privately; send the client something generic. */
export function serverError(context: string, err: unknown, message = "Something went wrong. Please try again.") {
  console.error(context, err instanceof Error ? { name: err.name, message: err.message } : err);
  return Response.json({ error: message }, { status: 500 });
}
