import type { ParsedSyllabus } from "@/lib/ai/syllabus-schema";
import { neededOnRemaining, summarize } from "@/lib/grades/calculator";
import { courseGradeInputs, type EntryRow, gradeTargets, letterFor, type WeightRow } from "@/lib/grades/course-grades";
import { formatWeight } from "@/lib/format";
import { addGradeEntry, removeGradeEntry, setWeightGuess } from "./actions";

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

/** Current grade from the scores the student enters, and what they need on the rest for each letter. */
export function GradesSection({
  courseId,
  parsed,
  weights,
  entries,
}: {
  courseId: string;
  parsed: ParsedSyllabus | null;
  weights: WeightRow[];
  entries: (EntryRow & { id: string; title: string | null })[];
}) {
  const { components, unweighted } = courseGradeInputs(parsed, weights, entries);
  const summary = summarize(components);
  const categories = [...components.map((c) => c.name), ...unweighted];
  const letter = summary.currentPercent == null ? null : letterFor(summary.currentPercent, parsed);

  return (
    <section aria-labelledby="grade-h" className="flex flex-col gap-4">
      <div>
        <h2 id="grade-h" className="font-medium">Your grade</h2>
        <p className="mt-1 text-sm text-ink-muted">Add scores as you get them back. Weights come from the syllabus.</p>
      </div>

      {summary.currentPercent == null ? (
        <p className="text-ink-muted">No scores yet.</p>
      ) : (
        <p>
          <span className="num text-2xl font-semibold">{pct(summary.currentPercent)}</span>
          {letter && <span className="num ml-2 text-lg">{letter}</span>}
          <span className="ml-3 text-sm text-ink-muted">
            so far, from {pct(summary.gradedWeight)} of the course{summary.isEstimate ? ". Estimate: uses a weight you guessed" : ""}
          </span>
        </p>
      )}

      {components.length > 0 && (
        <table className="w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-ink-muted">
              <th scope="col" className="py-2 font-medium">Category</th>
              <th scope="col" className="py-2 text-right font-medium">Weight</th>
              <th scope="col" className="py-2 pl-4 font-medium">Scores</th>
              <th scope="col" className="py-2 text-right font-medium">Average</th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => {
              const own = entries.filter((e) => e.component === c.name);
              const avg = summarize([c]).currentPercent;
              return (
                <tr key={c.name} className="border-b border-rule align-top">
                  <th scope="row" className="py-2 text-left font-normal">
                    {c.name}
                    {c.dropLowest ? <span className="block text-xs text-ink-muted">lowest {c.dropLowest} dropped once all are in</span> : null}
                  </th>
                  <td className="num py-2 text-right">{formatWeight(c.weight)}{c.weightIsGuess ? " (guess)" : ""}</td>
                  <td className="py-2 pl-4">
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                      {own.map((e) => (
                        <li key={e.id} className="num flex items-center gap-1">
                          {e.title ? `${e.title}: ` : ""}{Number(e.earned)}/{Number(e.possible)}
                          <form action={removeGradeEntry.bind(null, e.id)}>
                            <button type="submit" className="btn-quiet px-1 text-xs" aria-label={`Remove score ${Number(e.earned)} out of ${Number(e.possible)}`}>×</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="num py-2 text-right">{avg == null ? "" : pct(avg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {summary.remainingWeight > 0 && summary.gradedWeight > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">What you need on the remaining {pct(summary.remainingWeight)}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {gradeTargets(parsed).map((t) => {
              const need = neededOnRemaining(components, t.min_percent);
              if (need == null) return null;
              return (
                <li key={t.letter} className="num">
                  {t.letter} ({t.min_percent}% or more):{" "}
                  {need <= 0 ? "already locked in" : need > 100 ? `out of reach (would need ${pct(need)})` : `${pct(need)} average`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {unweighted.map((name) => (
        <form key={name} action={setWeightGuess.bind(null, courseId, name)} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-ink-muted">The syllabus doesn&apos;t give a weight for {name}. Your best guess:</span>
            <span className="flex items-center gap-2">
              <input name="weight" type="number" min={0} max={100} step="any" required className="input num w-24" aria-label={`Weight guess for ${name}, in percent`} />
              <span>%</span>
            </span>
          </label>
          <button type="submit" className="btn-secondary">Save guess</button>
        </form>
      ))}

      {categories.length > 0 ? (
        <form action={addGradeEntry.bind(null, courseId)} className="flex flex-wrap items-end gap-3 border-t border-rule pt-4">
          <label className="flex flex-col gap-1">
            <span className="label">Category</span>
            <select name="component" className="input w-auto" required>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Name <span className="font-normal text-ink-muted">(optional)</span></span>
            <input name="title" maxLength={120} className="input w-40" placeholder="Homework 3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Score</span>
            <input name="earned" type="number" min={0} step="any" required className="input num w-24" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Out of</span>
            <input name="possible" type="number" min={0.01} step="any" required className="input num w-24" />
          </label>
          <button type="submit" className="btn-primary">Add score</button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">This course has no grading categories yet. Upload its syllabus to use the calculator.</p>
      )}
    </section>
  );
}
