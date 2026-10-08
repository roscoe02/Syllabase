import "server-only";

/**
 * Rate My Professors lookup (UNOFFICIAL — no public API).
 *
 * Uses the same GraphQL endpoint as UTD Trends (MIT) src/modules/fetchRmp.ts.
 * RMP's terms prohibit automated scraping, so this is deliberately limited:
 *  - server-side only, one professor at a time, only for courses a user added
 *  - cached for 7 days; never bulk-crawled
 *  - aggregates only (no review text stored or sent to the LLM)
 *  - always attributed + linked to the RMP profile
 *  - RMP_ENABLED=false is a kill switch; the UI always shows a "View on RMP" link
 *    (rmpSearchUrl) even when the lookup is off or fails
 */

const ENDPOINT = "https://www.ratemyprofessors.com/graphql";
/** UT Dallas: legacy id 1273 -> GraphQL id base64("School-1273"). */
export const UTD_SCHOOL_ID = "U2Nob29sLTEyNzM=";

export interface RmpSummary {
  legacyId: number;
  name: string;
  department: string;
  avgRating: number;
  avgDifficulty: number;
  numRatings: number;
  wouldTakeAgainPercent: number;
  url: string;
}

const QUERY = `query ($text: String!, $schoolID: ID!) {
  newSearch { teachers(query: { text: $text, schoolID: $schoolID }) { edges { node {
    legacyId firstName lastName department avgRating avgDifficulty numRatings wouldTakeAgainPercent
  } } } }
}`;

export async function lookupProfessor(fullName: string, schoolId = UTD_SCHOOL_ID): Promise<RmpSummary | null> {
  if (process.env.RMP_ENABLED === "false") return null;
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic dGVzdDp0ZXN0",
        Referer: "https://www.ratemyprofessors.com/",
      },
      body: JSON.stringify({ query: QUERY, variables: { text: fullName, schoolID: schoolId } }),
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
  } catch {
    return null; // RMP unreachable: the UI falls back to rmpSearchUrl()
  }
  if (!res.ok) return null;
  const json = await res.json();
  type Node = Omit<RmpSummary, "name" | "url"> & { firstName: string; lastName: string };
  const nodes: Node[] = json?.data?.newSearch?.teachers?.edges?.map((e: { node: Node }) => e.node) ?? [];
  // Same heuristic as UTD Trends: the matching profile with the most ratings wins.
  const best = nodes.sort((a, b) => b.numRatings - a.numRatings)[0];
  if (!best) return null;
  return {
    legacyId: best.legacyId,
    name: `${best.firstName} ${best.lastName}`,
    department: best.department,
    avgRating: best.avgRating,
    avgDifficulty: best.avgDifficulty,
    numRatings: best.numRatings,
    wouldTakeAgainPercent: best.wouldTakeAgainPercent,
    url: `https://www.ratemyprofessors.com/professor/${best.legacyId}`,
  };
}

/** Link-out that works even without a lookup: RMP's own search, scoped to the school. */
export function rmpSearchUrl(fullName: string, legacySchoolId = 1273): string {
  return `https://www.ratemyprofessors.com/search/professors/${legacySchoolId}?q=${encodeURIComponent(fullName)}`;
}
