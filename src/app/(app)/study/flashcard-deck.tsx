"use client";

import { useState } from "react";
import type { Flashcards } from "@/lib/study/outputs";

/** One card at a time: flip to see the answer and the common wrong answer. */
export function FlashcardDeck({ cards }: { cards: Flashcards["cards"] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];
  const go = (i: number) => {
    setIndex(i);
    setFlipped(false);
  };
  if (!card) return <p className="text-ink-muted">No cards came back. Try different materials.</p>;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Show answer"}
        className="flex min-h-48 flex-col justify-center gap-3 rounded-md border border-rule p-6 text-left hover:border-ink-muted"
      >
        <span className="text-xs uppercase tracking-wide text-ink-muted">{flipped ? "Answer" : "Question"}</span>
        <span className="text-lg">{flipped ? card.back : card.front}</span>
        {flipped && <span className="text-sm text-ink-muted">Common wrong answer: {card.common_wrong_answer}</span>}
      </button>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => go(index - 1)} disabled={index === 0}>Previous</button>
        <span className="num text-sm text-ink-muted" aria-live="polite">Card {index + 1} of {cards.length}</span>
        <button type="button" className="btn-secondary" onClick={() => go(index + 1)} disabled={index === cards.length - 1}>Next</button>
        <span className="text-sm text-ink-muted">Click the card to flip it.</span>
      </div>
    </div>
  );
}
