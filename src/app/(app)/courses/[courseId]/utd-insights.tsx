import { lookupProfessor, rmpSearchUrl } from "@/lib/integrations/rmp";
import type { Distribution } from "@/lib/integrations/utd-grade-data";
import { courseGrades } from "@/lib/integrations/utd-grades";

const GROUPS = [
  ["A", [0, 1, 2]],
  ["B", [3, 4, 5]],
  ["C", [6, 7, 8]],
  ["D", [9, 10, 11]],
  ["F", [12]],
  ["W", [13]],
] as const;

const share = (d: Distribution, idx: readonly number[]) => (d.students ? (idx.reduce((s, i) => s + d.counts[i], 0) / d.students) * 100 : 0);

function Bar({ percent }: { percent: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 rounded-sm bg-rule" aria-hidden="true">
        <span className="block h-2 rounded-sm bg-ink-muted" style={{ width: `${percent}%` }} />
      </span>
      <span className="num w-10 text-right">{Math.round(percent)}%</span>
    </span>
  );
}

/** Past grades for this UT Dallas course and the professor's Rate My Professors summary. Nothing for other schools. */
export async function UtdInsights({ subject, number, instructor }: { subject: string; number: string; instructor: string | null }) {
  const [grades, rmp] = await Promise.all([courseGrades(subject, number, instructor), instructor ? lookupProfessor(instructor) : null]);
  if (!grades) return null;
  const trends = `https://trends.utdnebula.com/dashboard?searchTerms=${encodeURIComponent(`${subject} ${number}`)}`;

  return (
    <section aria-labelledby="utd-h" className="flex flex-col gap-4">
      <div>
        <h2 id="utd-h" className="font-medium">Past grades at UT Dallas</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {subject} {number}, {grades.firstTerm} to {grades.lastTerm}: <span className="num">{grades.all.students.toLocaleString("en-US")}</span> students
          in <span className="num">{grades.all.sections}</span> sections.
        </p>
      </div>

      <table className="w-full max-w-md border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-ink-muted">
            <th scope="col" className="py-2 pr-4 font-medium">Grade</th>
            <th scope="col" className="py-2 font-medium">All sections</th>
            {grades.professor && <th scope="col" className="py-2 pl-4 font-medium">This professor</th>}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map(([letter, idx]) => (
            <tr key={letter} className="border-b border-rule">
              <th scope="row" className="py-1 pr-4 text-left font-normal">{letter}</th>
              <td className="py-1"><Bar percent={share(grades.all, idx)} /></td>
              {grades.professor && <td className="py-1 pl-4"><Bar percent={share(grades.professor, idx)} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {instructor && !grades.professor && (
        <p className="text-sm text-ink-muted">No past sections found for {instructor}, so this is every section of the course.</p>
      )}

      {instructor && (
        <p className="text-sm">
          {rmp && rmp.numRatings > 0 ? (
            <>
              {rmp.name} on Rate My Professors: <span className="num">{rmp.avgRating.toFixed(1)}</span>/5 overall, difficulty{" "}
              <span className="num">{rmp.avgDifficulty.toFixed(1)}</span>/5
              {rmp.wouldTakeAgainPercent >= 0 && <>, <span className="num">{Math.round(rmp.wouldTakeAgainPercent)}%</span> would take again</>}{" "}
              (<span className="num">{rmp.numRatings}</span> ratings).{" "}
              <a href={rmp.url} className="underline underline-offset-2">View on Rate My Professors</a>
            </>
          ) : (
            <a href={rmpSearchUrl(instructor)} className="underline underline-offset-2">Search Rate My Professors for {instructor}</a>
          )}
        </p>
      )}

      <p className="text-sm">
        <a href={trends} className="underline underline-offset-2">More on UTD Trends</a>
      </p>
      <p className="text-xs text-ink-muted">
        Grade data from{" "}
        <a href="https://github.com/acmutd/utd-grades" className="underline underline-offset-2">ACM UTD&apos;s utd-grades</a> (Texas public
        records). Ratings from Rate My Professors. Not affiliated with UT Dallas.
      </p>
    </section>
  );
}
