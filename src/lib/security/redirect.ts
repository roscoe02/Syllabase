/** Where to send the user after sign-in: a path on this site, or `fallback`. Blocks "//x" and "/\\x" open redirects. */
export function safeNextPath(next: string | null, origin: string, fallback = "/dashboard"): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
