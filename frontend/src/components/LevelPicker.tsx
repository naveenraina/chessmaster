/**
 * Picks one of the 100 bot levels.
 *
 * Tier tabs (Beginner, Novice, ... Grandmaster) choose which group of levels
 * is shown; the numbered grid below picks the exact level. ◀ ▶ step one level
 * at a time, which is the easiest way to make the bot a little harder after a win.
 */
import { useEffect, useState } from 'react';
import type { ChessGame } from '../hooks/useChessGame';

export function LevelPicker({ chess }: { chess: ChessGame }) {
  const { tiers, difficulties, settings, thinking } = chess;
  const current = difficulties.find((d) => d.id === settings.difficulty);
  const maxLevel = difficulties.length;

  // The tier being browsed; follows the selected level unless the player taps another tab.
  const [viewTier, setViewTier] = useState<string | null>(null);
  useEffect(() => setViewTier(current?.tier ?? null), [current?.tier]);

  const tier = tiers.find((t) => t.id === viewTier) ?? tiers[0];
  if (!tier || !current) return null;

  const levelsInTier = difficulties.filter((d) => d.tier === tier.id);
  const step = (delta: number) => chess.changeDifficulty(Math.min(maxLevel, Math.max(1, current.id + delta)));

  return (
    <div className="level-picker">
      <div className="level-stepper">
        <button className="step" onClick={() => step(-1)} disabled={thinking || current.id <= 1} aria-label="Easier">◀</button>
        <div className="level-current">
          <span className="level-current-emoji">{current.emoji}</span>
          <span>
            <strong>Level {current.id}</strong>
            <span className="level-current-name">{current.name}</span>
          </span>
        </div>
        <button className="step" onClick={() => step(1)} disabled={thinking || current.id >= maxLevel} aria-label="Harder">▶</button>
      </div>

      <div className="tier-tabs" role="tablist" aria-label="Level groups">
        {tiers.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tier.id}
            className={`tier-tab ${t.id === tier.id ? 'active' : ''} ${t.id === current.tier ? 'has-current' : ''}`}
            onClick={() => setViewTier(t.id)}
            title={`Levels ${t.from}–${t.to}`}
          >
            {t.emoji} {t.name}
          </button>
        ))}
      </div>

      <p className="level-desc">
        {tier.emoji} <strong>{tier.name}</strong> (levels {tier.from}–{tier.to}): {tier.description}
      </p>

      <div className="level-grid" role="radiogroup" aria-label={`${tier.name} levels`}>
        {levelsInTier.map((d) => (
          <button
            key={d.id}
            role="radio"
            aria-checked={d.id === current.id}
            aria-label={`Level ${d.id}, ${d.name}`}
            className={`level-cell ${d.id === current.id ? 'active' : ''}`}
            onClick={() => chess.changeDifficulty(d.id)}
            disabled={thinking}
            title={d.name}
          >
            {d.id}
          </button>
        ))}
      </div>
    </div>
  );
}
