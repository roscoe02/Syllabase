/**
 * Parsing and summing UT Dallas grade distributions from ACM UTD's utd-grades files (MIT; Texas public records).
 * One row per section: counts for A+ through F, then W, and up to six instructors as "Last, First".
 */

export const LETTERS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F", "W"] as const;

export interface SectionGrades {
  subject: string;
  number: string;
  counts: number[];
  instructors: string[];
  title: string | null;
}

export interface Distribution {
  counts: number[];
  students: number;
  sections: number;
}

/** "Dr. Jane Q. Smith, Ph.D." or "Smith, Jane" -> { first: "jane", last: "smith" }. */
export function splitName(name: string | null): { first: string; last: string } | null {
  if (!name) return null;
  let s = name.replace(/\b(dr|prof|professor|mr|mrs|ms|mx)\b\.?/gi, " ").replace(/,?\s*\b(ph\.?\s?d|ed\.?d|m\.?d|jr|sr|iii|ii)\b\.?/gi, " ");
  if (s.includes(",")) {
    const [last, first] = s.split(",", 2);
    s = `${first} ${last}`;
  }
  const words = s.replace(/[^\p{L}\s'-]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return { first: words.length > 1 ? words[0].toLowerCase() : "", last: words[words.length - 1].toLowerCase() };
}

/** Same last name, and the same first name (or initial, when one side only has an initial). */
export function samePerson(a: { first: string; last: string }, b: { first: string; last: string }) {
  if (a.last !== b.last) return false;
  if (!a.first || !b.first) return true;
  return a.first.length === 1 || b.first.length === 1 ? a.first[0] === b.first[0] : a.first === b.first;
}

function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Rows of one course from a term's file. Filtering here keeps the cached result small. */
export function parseGradeCsv(text: string, subject: string, number: string): SectionGrades[] {
  const [header, ...lines] = text.split(/\r?\n/);
  const cols = csvLine(header).map((c) => c.trim());
  const at = (name: string) => cols.indexOf(name);
  const letterCols = LETTERS.map(at);
  const instructorCols = cols.map((c, i) => (/^Instructor \d$/.test(c) ? i : -1)).filter((i) => i >= 0);
  const [s, n, t] = [at("Subject"), at("Catalog Nbr"), at("title")];
  const rows: SectionGrades[] = [];
  for (const line of lines) {
    if (!line.startsWith(`${subject},${number},`)) continue;
    const f = csvLine(line);
    rows.push({
      subject: f[s],
      number: f[n],
      counts: letterCols.map((i) => (i >= 0 ? Number(f[i]) || 0 : 0)),
      instructors: instructorCols.map((i) => f[i]?.trim()).filter(Boolean),
      title: t >= 0 ? f[t]?.trim() || null : null,
    });
  }
  return rows;
}

export function sumGrades(rows: SectionGrades[]): Distribution {
  const counts = LETTERS.map((_, i) => rows.reduce((sum, r) => sum + r.counts[i], 0));
  return { counts, students: counts.reduce((a, b) => a + b, 0), sections: rows.length };
}

/** Sections taught by the named professor. */
export function byProfessor(rows: SectionGrades[], name: string | null): SectionGrades[] {
  const who = splitName(name);
  if (!who) return [];
  return rows.filter((r) => r.instructors.some((i) => {
    const other = splitName(i);
    return other ? samePerson(who, other) : false;
  }));
}

/** "CS 3345" or "cs3345.001" -> { subject: "CS", number: "3345" }. */
export function courseParts(code: string | null): { subject: string; number: string } | null {
  const m = code?.toUpperCase().match(/\b([A-Z]{2,4})\s*-?\s*(\d{4})\b/);
  return m ? { subject: m[1], number: m[2] } : null;
}
