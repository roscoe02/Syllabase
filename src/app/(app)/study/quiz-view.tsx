"use client";

import { useState } from "react";
import type { Quiz } from "@/lib/study/outputs";

/** Answer each question, then reveal the right answer and the mistake most students make. */
export function QuizView({ questions }: { questions: Quiz["questions"] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const multipleChoice = questions.filter((q) => q.type === "multiple_choice" && q.options.length > 0);
  const checked = questions.filter((q, i) => revealed[i] && q.type === "multiple_choice");
  const correct = questions.filter((q, i) => revealed[i] && q.type === "multiple_choice" && picked[i] === q.correct_option).length;

  return (
    <div className="flex flex-col gap-6">
      {multipleChoice.length > 0 && (
        <p className="num text-sm text-ink-muted" aria-live="polite">
          Multiple choice: {correct} right out of {checked.length} checked, {multipleChoice.length} in all
        </p>
      )}
      <ol className="flex flex-col gap-6">
        {questions.map((q, i) => (
          <li key={i} className="flex flex-col gap-3 border-b border-rule pb-6">
            <p className="font-medium"><span className="num mr-2 text-ink-muted">{i + 1}.</span>{q.question}</p>
            {q.type === "multiple_choice" && q.options.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Options for question {i + 1}</legend>
                {q.options.map((o, j) => {
                  const state = revealed[i] ? (j === q.correct_option ? "font-medium" : picked[i] === j ? "line-through text-ink-muted" : "") : "";
                  return (
                    <label key={j} className={`flex items-start gap-2 ${state}`}>
                      <input type="radio" name={`q${i}`} checked={picked[i] === j} disabled={revealed[i]} onChange={() => setPicked((p) => ({ ...p, [i]: j }))} className="mt-1" />
                      <span>{o}{revealed[i] && j === q.correct_option ? " (correct)" : ""}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <textarea rows={3} className="input" placeholder="Your answer (for you; it isn't graded)" aria-label={`Your answer to question ${i + 1}`} />
            )}
            {revealed[i] ? (
              <div className="flex flex-col gap-1 text-sm">
                <p><span className="font-medium">Answer: </span>{q.answer}</p>
                <p className="text-ink-muted"><span className="font-medium">Common mistake: </span>{q.common_wrong_answer}</p>
              </div>
            ) : (
              <div>
                <button type="button" className="btn-secondary" onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>
                  {q.type === "multiple_choice" ? "Check" : "Show answer"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
