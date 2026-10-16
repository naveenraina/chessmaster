/**
 * Checks the generated level table: 500 levels, every level in exactly one
 * tier, strength that never drops from one level to the next, and no two
 * neighbouring levels with identical settings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, MAX_LEVEL, TIERS, getDifficulty, listDifficulties } from '../src/difficulty.js';

/** null Elo means "no limit", i.e. stronger than any number. */
const eloValue = (level) => level.elo ?? Infinity;

test('there are 500 levels and the tiers cover them without gaps', () => {
  assert.equal(MAX_LEVEL, 500);
  assert.equal(Object.keys(DIFFICULTIES).length, MAX_LEVEL);
  assert.equal(TIERS[0].from, 1);
  assert.equal(TIERS.at(-1).to, MAX_LEVEL);
  for (let i = 1; i < TIERS.length; i++) {
    assert.equal(TIERS[i].from, TIERS[i - 1].to + 1, `gap before ${TIERS[i].name}`);
  }
});

test('every level is a little stronger than the one before', () => {
  for (let n = 2; n <= MAX_LEVEL; n++) {
    const prev = DIFFICULTIES[n - 1];
    const cur = DIFFICULTIES[n];
    assert.ok(eloValue(cur) >= eloValue(prev), `elo at ${n}`);
    assert.ok(cur.depth >= prev.depth, `depth at ${n}`);
    assert.ok(cur.movetimeMs >= prev.movetimeMs, `movetime at ${n}`);
    assert.ok(cur.randomChance <= prev.randomChance, `random chance at ${n}`);
    const same = cur.elo === prev.elo && cur.depth === prev.depth && cur.movetimeMs === prev.movetimeMs && cur.randomChance === prev.randomChance;
    assert.ok(!same, `level ${n} has the same settings as level ${n - 1}`);
  }
});

test('Elo stays inside what Stockfish accepts; the top level is unlimited', () => {
  for (let n = 1; n < MAX_LEVEL; n++) {
    const { elo } = DIFFICULTIES[n];
    assert.ok(Number.isInteger(elo) && elo >= 1320 && elo <= 3190, `elo ${elo} at level ${n}`);
  }
  assert.equal(DIFFICULTIES[MAX_LEVEL].elo, null);
  assert.equal(DIFFICULTIES[MAX_LEVEL].randomChance, 0);
});

test('lookups and the public list', () => {
  assert.equal(getDifficulty(0), null);
  assert.equal(getDifficulty(501), null);
  assert.equal(getDifficulty('200').tier, 'intermediate');
  const { tiers, levels } = listDifficulties();
  assert.equal(tiers.length, TIERS.length);
  assert.equal(levels.length, MAX_LEVEL);
  assert.equal(levels[0].elo, undefined, 'engine tuning is not exposed');
});
