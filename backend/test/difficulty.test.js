/**
 * Checks the generated level table: 100 levels, every level in exactly one
 * tier, and strength that never drops from one level to the next.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, MAX_LEVEL, TIERS, getDifficulty, listDifficulties } from '../src/difficulty.js';

test('there are 100 levels and the tiers cover them without gaps', () => {
  assert.equal(Object.keys(DIFFICULTIES).length, 100);
  assert.equal(TIERS[0].from, 1);
  assert.equal(TIERS.at(-1).to, MAX_LEVEL);
  for (let i = 1; i < TIERS.length; i++) {
    assert.equal(TIERS[i].from, TIERS[i - 1].to + 1, `gap before ${TIERS[i].name}`);
  }
});

test('strength never decreases as the level goes up', () => {
  for (let n = 2; n <= MAX_LEVEL; n++) {
    const prev = DIFFICULTIES[n - 1];
    const cur = DIFFICULTIES[n];
    assert.ok(cur.skill >= prev.skill, `skill at ${n}`);
    assert.ok(cur.depth >= prev.depth, `depth at ${n}`);
    assert.ok(cur.movetimeMs >= prev.movetimeMs, `movetime at ${n}`);
    assert.ok(cur.randomChance <= prev.randomChance, `random chance at ${n}`);
  }
  assert.equal(DIFFICULTIES[100].skill, 20);
  assert.equal(DIFFICULTIES[100].randomChance, 0);
});

test('lookups and the public list', () => {
  assert.equal(getDifficulty(0), null);
  assert.equal(getDifficulty(101), null);
  assert.equal(getDifficulty('37').tier, 'intermediate');
  const { tiers, levels } = listDifficulties();
  assert.equal(tiers.length, TIERS.length);
  assert.equal(levels.length, 100);
  assert.equal(levels[0].skill, undefined, 'engine tuning is not exposed');
});
