import "server-only";
import { cacheLife } from "next/cache";
import { byProfessor, parseGradeCsv, sumGrades, type Distribution } from "./utd-grade-data";

/**
 * Past grade distributions for a UT Dallas course, from ACM UTD's utd-grades repository (MIT; the data comes from
 * Texas public records requests). Credit it wherever this is shown.
 */

const SOURCE = "https://raw.githubusercontent.com/acmutd/utd-grades/master/raw_data/enhanced_grades_enhanced_grades_";
// The latest four fall/spring terms in the repository; add newer terms as they are published.
const TERMS = [
  ["25f", "Fall 2025"],
  ["25s", "Spring 2025"],
  ["24f", "Fall 2024"],
  ["24s", "Spring 2024"],
] as const;

export interface CourseGrades {
  title: string | null;
  firstTerm: string;
  lastTerm: string;
  all: Distribution;
  professor: Distribution | null;
}

/** Throws when a file can't be fetched, so an outage isn't cached as "no data". */
export async function courseGrades(subject: string, number: string, instructor: string | null): Promise<CourseGrades | null> {
  "use cache";
  cacheLife("weeks");
  const files = await Promise.all(
    TERMS.map(async ([file]) => {
      const res = await fetch(`${SOURCE}${file}.csv`);
      if (!res.ok) throw new Error(`utd-grades ${file}: ${res.status}`);
      return parseGradeCsv(await res.text(), subject, number);
    }),
  );
  const rows = files.flat();
  if (rows.length === 0) return null;
  const terms = TERMS.filter((_, i) => files[i].length > 0).map(([, name]) => name);
  const theirs = byProfessor(rows, instructor);
  return {
    title: rows.find((r) => r.title)?.title ?? null,
    firstTerm: terms[terms.length - 1],
    lastTerm: terms[0],
    all: sumGrades(rows),
    professor: theirs.length ? sumGrades(theirs) : null,
  };
}
