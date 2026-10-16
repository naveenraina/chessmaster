/** Move list in numbered pairs ("1. e4 e5"), auto-scrolled to the latest move. */
import { useEffect, useRef } from 'react';
import type { MoveSummary } from '../types';

export function MoveHistory({ moves }: { moves: MoveSummary[] }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [moves.length]);

  const rows: { white?: string; black?: string }[] = [];
  moves.forEach((m, i) => {
    // A game where the bot is white still starts with white's move, so pair by index.
    if (i % 2 === 0) rows.push({ white: m.san });
    else rows[rows.length - 1].black = m.san;
  });

  return (
    <section className="panel history">
      <h2>📜 Moves</h2>
      {rows.length === 0 ? (
        <p className="muted">No moves yet — make the first one!</p>
      ) : (
        <ol ref={listRef}>
          {rows.map((r, i) => (
            <li key={i}>
              <span className="move-no">{i + 1}.</span>
              <span>{r.white}</span>
              <span>{r.black ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
