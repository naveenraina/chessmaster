/**
 * Picks one of the 500 bot levels.
 *
 * - « ◀ ▶ »  step 10 or 1 levels at a time (crossing into the next tier as needed)
 * - tier tabs (Beginner … Grandmaster) jump to a group of levels
 * - the slider picks any level inside the open tier
 *
 * Dragging the slider only previews; the level is sent to the server once the
 * slider stops moving, so a drag doesn't fire dozens of requests.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChessGame } from '../hooks/useChessGame';

const COMMIT_DELAY_MS = 350;

export function LevelPicker({ chess }: { chess: ChessGame }) {
  const { tiers, difficulties, settings, thinking, changeDifficulty } = chess;
  const maxLevel = difficulties.length;

  // Level shown in the picker; runs ahead of settings.difficulty while the slider moves.
  const [draft, setDraft] = useState(settings.difficulty);
  useEffect(() => setDraft(settings.difficulty), [settings.difficulty]);

  const commitTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const shown = difficulties.find((d) => d.id === draft);

  // The tier being browsed; follows the shown level unless the player taps another tab.
  const [viewTier, setViewTier] = useState<string | null>(null);
  useEffect(() => setViewTier(shown?.tier ?? null), [shown?.tier]);

  const tier = tiers.find((t) => t.id === viewTier) ?? tiers[0];
  if (!tier || !shown) return null;

  const clamp = (n: number) => Math.min(maxLevel, Math.max(1, n));

  function select(level: number, delayed = false) {
    const next = clamp(level);
    setDraft(next);
    window.clearTimeout(commitTimer.current);
    if (next === settings.difficulty) return;
    if (delayed) commitTimer.current = window.setTimeout(() => changeDifficulty(next), COMMIT_DELAY_MS);
    else changeDifficulty(next);
  }

  const inViewTier = shown.tier === tier.id;

  return (
    <div className="level-picker">
      <div className="level-stepper">
        <button className="step" onClick={() => select(draft - 10)} disabled={thinking || draft <= 1} aria-label="10 levels easier">«</button>
        <button className="step" onClick={() => select(draft - 1)} disabled={thinking || draft <= 1} aria-label="Easier">◀</button>
        <div className="level-current" aria-live="polite">
          <span className="level-current-emoji">{shown.emoji}</span>
          <span>
            <strong>Level {shown.id}</strong>
            <span className="level-current-name">{shown.name}</span>
          </span>
        </div>
        <button className="step" onClick={() => select(draft + 1)} disabled={thinking || draft >= maxLevel} aria-label="Harder">▶</button>
        <button className="step" onClick={() => select(draft + 10)} disabled={thinking || draft >= maxLevel} aria-label="10 levels harder">»</button>
      </div>

      <div className="tier-tabs" role="tablist" aria-label="Level groups">
        {tiers.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tier.id}
            className={`tier-tab ${t.id === tier.id ? 'active' : ''} ${t.id === shown.tier ? 'has-current' : ''}`}
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

      <div className="tier-slider">
        <input
          type="range"
          min={tier.from}
          max={tier.to}
          // Outside this tier, park the thumb at the end nearest the current level.
          value={inViewTier ? draft : draft < tier.from ? tier.from : tier.to}
          onChange={(e) => select(Number(e.target.value), true)}
          disabled={thinking}
          aria-label={`${tier.name} level`}
          className={inViewTier ? '' : 'inactive'}
        />
        <div className="tier-slider-labels">
          <span>{tier.from}</span>
          {!inViewTier && (
            <button className="link-btn" onClick={() => select(tier.from)} disabled={thinking}>
              Start {tier.name} at level {tier.from}
            </button>
          )}
          <span>{tier.to}</span>
        </div>
      </div>
    </div>
  );
}
