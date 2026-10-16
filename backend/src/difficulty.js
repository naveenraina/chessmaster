/**
 * Bot difficulty levels: 500 levels grouped into tiers.
 *
 * Stockfish is far too strong for a young player even at its weakest setting,
 * so the lower levels also make the bot play a random legal move some of the
 * time. That gives it human-looking blunders a child can learn to punish.
 *
 * Every level is generated from its number, so strength rises smoothly:
 *  - elo:          Stockfish UCI_Elo (1320-3190), which limits strength in fine
 *                  steps. null = no limit (full strength, top level only).
 *                  "Skill Level" has only 21 steps, too coarse for 500 levels.
 *  - depth:        maximum search depth in plies
 *  - movetimeMs:   maximum thinking time per move
 *  - randomChance: probability (0-1) of playing a random legal move instead
 *
 * The tiers are only labels for the child; the Elo numbers are engine settings,
 * not real-world ratings. To retune strength, change the curves in buildLevel().
 * To change how many levels each tier has, edit TIERS (and MAX_LEVEL).
 */
export const MAX_LEVEL = 500;

/** Random moves fade out completely by this level. */
const LAST_RANDOM_LEVEL = 300;

const MIN_ELO = 1320;
const MAX_ELO = 3190;

export const TIERS = [
  { id: 'beginner', name: 'Beginner', emoji: '🐣', from: 1, to: 100, description: 'Just learning how the pieces move — blunders a lot' },
  { id: 'novice', name: 'Novice', emoji: '🐰', from: 101, to: 175, description: 'Knows the rules but still makes silly mistakes' },
  { id: 'intermediate', name: 'Intermediate', emoji: '🦊', from: 176, to: 275, description: 'Grabs any piece you leave hanging' },
  { id: 'advanced', name: 'Advanced', emoji: '🦉', from: 276, to: 350, description: 'Thinks a few moves ahead and rarely blunders' },
  { id: 'expert', name: 'Expert', emoji: '🦁', from: 351, to: 425, description: 'A strong tournament player' },
  { id: 'master', name: 'Master', emoji: '🐉', from: 426, to: 475, description: 'Plays like a chess master' },
  { id: 'grandmaster', name: 'Grandmaster', emoji: '👑', from: 476, to: 500, description: 'Near or at full-strength Stockfish' },
];

function buildLevel(id) {
  const tier = TIERS.find((t) => id >= t.from && id <= t.to);
  const t = (id - 1) / (MAX_LEVEL - 1); // 0 at level 1, 1 at the top level
  const randomFade = Math.max(0, 1 - (id - 1) / (LAST_RANDOM_LEVEL - 1));

  return {
    id,
    name: `${tier.name} ${id - tier.from + 1}`,
    emoji: tier.emoji,
    tier: tier.id,
    description: tier.description,
    elo: id === MAX_LEVEL ? null : Math.round(MIN_ELO + (MAX_ELO - MIN_ELO) * t ** 1.2),
    depth: 1 + Math.round(17 * t ** 1.5),
    movetimeMs: Math.round(100 + 1400 * t ** 2),
    randomChance: Math.round(0.6 * randomFade ** 1.5 * 1000) / 1000,
  };
}

export const DIFFICULTIES = Object.fromEntries(
  Array.from({ length: MAX_LEVEL }, (_, i) => [i + 1, buildLevel(i + 1)]),
);

export const DEFAULT_DIFFICULTY = 1;

/** Returns the level config, or null when the id is not a known level. */
export function getDifficulty(id) {
  return DIFFICULTIES[Number(id)] ?? null;
}

/** Public data for the UI (hides the engine tuning numbers). */
export function listDifficulties() {
  return {
    tiers: TIERS.map(({ id, name, emoji, from, to, description }) => ({ id, name, emoji, from, to, description })),
    levels: Object.values(DIFFICULTIES).map(({ id, name, emoji, tier, description }) => ({ id, name, emoji, tier, description })),
  };
}
