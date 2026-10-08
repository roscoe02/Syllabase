import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp } from "./ip";

/**
 * Fetch a URL a user gave us (calendar feeds) without letting them point our server at
 * internal addresses (SSRF): https only, every hop's host must resolve to a public IP,
 * at most 3 redirects, a timeout, and a response size cap.
 *
 * Known limit: fetch() resolves the host again after our check, so a DNS-rebinding host could still
 * swap in a private IP between the two lookups. Pin the checked IP with an undici dispatcher if this
 * ever fetches anything more sensitive than calendar feeds.
 */

const MAX_REDIRECTS = 3;

async function assertPublicHttps(url: URL) {
  if (url.protocol !== "https:") throw new UnsafeUrlError("Only https:// links are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("Links with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeUrlError("That link points to a private network address");
  }
}

export class UnsafeUrlError extends Error {}

export async function safeFetchText(rawUrl: string, opts: { maxBytes: number; timeoutMs: number }): Promise<string> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(opts.timeoutMs);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttps(url);
    const res = await fetch(url, { redirect: "manual", cache: "no-store", signal });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`Upstream returned ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > opts.maxBytes) throw new Error("Response too large");

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many redirects");
}
