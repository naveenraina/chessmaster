/**
 * Bot difficulty levels: 100 levels grouped into tiers.
 *
 * Stockfish is far too strong for a young player even at "Skill Level 0", so
 * the lower levels also make the bot play a random legal move some of the
 * time. That gives it human-looking blunders a child can learn to punish.
 *
 * Every level is generated from its number, so strength rises smoothly:
 *  - skill:        Stockfish "Skill Level" UCI option (0-20)
 *  - depth:        maximum search depth in plies
 *  - movetimeMs:   maximum thinking time per move
 *  - randomChance: probability (0-1) of playing a random legal move instead
 *
 * The tiers are only labels; to retune strength, change the curves in
 * buildLevel(). To change how many levels each tier has, edit TIERS.
 */
export const MAX_LEVEL = 100;

/** Random moves fade out completely by this level. */
const LAST_RANDOM_LEVEL = 60;

export const TIERS = [
  { id: 'beginner', name: 'Beginner', emoji: '🐣', from: 1, to: 20, description: 'Just learning how the pieces move — blunders a lot' },
  { id: 'novice', name: 'Novice', emoji: '🐰', from: 21, to: 35, description: 'Knows the rules but still makes silly mistakes' },
  { id: 'intermediate', name: 'Intermediate', emoji: '🦊', from: 36, to: 55, description: 'Grabs any piece you leave hanging' },
  { id: 'advanced', name: 'Advanced', emoji: '🦉', from: 56, to: 70, description: 'Thinks a few moves ahead and rarely blunders' },
  { id: 'expert', name: 'Expert', emoji: '🦁', from: 71, to: 85, description: 'A strong tournament player' },
  { id: 'master', name: 'Master', emoji: '🐉', from: 86, to: 95, description: 'Plays like a chess master' },
  { id: 'grandmaster', name: 'Grandmaster', emoji: '👑', from: 96, to: 100, description: 'Near or at full-strength Stockfish' },
];

function buildLevel(id) {
  const tier = TIERS.find((t) => id >= t.from && id <= t.to);
  const t = (id - 1) / (MAX_LEVEL - 1); // 0 at level 1, 1 at level 100
  const randomFade = Math.max(0, 1 - (id - 1) / (LAST_RANDOM_LEVEL - 1));

  return {
    id,
    name: `${tier.name} ${id - tier.from + 1}`,
    emoji: tier.emoji,
    tier: tier.id,
    description: tier.description,
    skill: Math.round(20 * t ** 1.3),
    depth: 1 + Math.round(17 * t ** 1.5),
    movetimeMs: Math.round(100 + 1400 * t ** 2),
    randomChance: Math.round(0.6 * randomFade ** 1.5 * 100) / 100,
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
