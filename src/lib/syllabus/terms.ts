/**
 * Term choices for the upload flow. The date windows are deliberately generous and are only used to
 * spot an outdated syllabus (checkFreshness); they are never shown as real term dates. The exact
 * first day of classes comes from the student, when they know it.
 */
export type Season = "Spring" | "Summer" | "Fall";

const WINDOWS: Record<Season, [string, string]> = {
  Spring: ["01-01", "05-31"],
  Summer: ["05-15", "08-20"],
  Fall: ["08-01", "12-31"],
};

export function termWindow(season: Season, year: number) {
  const [start, end] = WINDOWS[season];
  return { name: `${season} ${year}`, start: `${year}-${start}`, end: `${year}-${end}` };
}

/** The current term and the next two, based on today's date. */
export function upcomingTerms(today: Date = new Date()) {
  const order: Season[] = ["Spring", "Summer", "Fall"];
  const m = today.getMonth() + 1;
  let season: Season = m <= 5 ? "Spring" : m <= 7 ? "Summer" : "Fall";
  let year = today.getFullYear();
  const out = [];
  for (let i = 0; i < 3; i++) {
    out.push(termWindow(season, year));
    const next = (order.indexOf(season) + 1) % 3;
    if (next === 0) year += 1;
    season = order[next];
  }
  return out;
}
