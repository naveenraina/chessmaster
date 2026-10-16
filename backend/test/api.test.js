/**
 * End-to-end API tests against the real Stockfish engine.
 * Run with: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { engine } from '../src/engine.js';
import { getGame } from '../src/gameStore.js';

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});

after(() => {
  engine.stop();
  server.close();
});

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text() };
}

test('new game, player move gets a bot reply', async () => {
  const { status, body: game } = await call('POST', '/newgame', { difficulty: 3 });
  assert.equal(status, 201);
  assert.equal(game.playerColor, 'w');
  assert.equal(game.moves.length, 0);

  const { body: after } = await call('POST', '/move', { gameId: game.gameId, from: 'e2', to: 'e4' });
  assert.equal(after.moves.length, 2, 'player move + bot reply');
  assert.equal(after.turn, 'w');
  assert.ok(after.botComment);
});

test('illegal move is rejected', async () => {
  const { body: game } = await call('POST', '/newgame', {});
  const res = await call('POST', '/move', { gameId: game.gameId, from: 'e2', to: 'e5' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /isn't allowed/);
});

test('playing black makes the bot open', async () => {
  const { body: game } = await call('POST', '/newgame', { playerColor: 'b', difficulty: 4 });
  assert.equal(game.moves.length, 1);
  assert.equal(game.turn, 'b');

  // Undo must never take back the bot's opening move.
  const { body: undone } = await call('POST', '/undo', { gameId: game.gameId });
  assert.equal(undone.moves.length, 1);
});

test('undo takes back the player move and the bot reply', async () => {
  const { body: game } = await call('POST', '/newgame', {});
  await call('POST', '/move', { gameId: game.gameId, from: 'd2', to: 'd4' });
  const { body: undone } = await call('POST', '/undo', { gameId: game.gameId });
  assert.equal(undone.moves.length, 0);
  assert.equal(undone.fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
});

test('hint, difficulty change and PGN export', async () => {
  const { body: game } = await call('POST', '/newgame', {});
  const hint = await call('GET', `/hint/${game.gameId}`);
  assert.equal(hint.status, 200);
  assert.match(hint.body.from, /^[a-h][1-8]$/);
  assert.ok(hint.body.explanation);

  const changed = await call('POST', '/difficulty', { gameId: game.gameId, difficulty: 100 });
  assert.equal(changed.body.difficulty, 100);
  assert.equal((await call('POST', '/difficulty', { gameId: game.gameId, difficulty: 101 })).status, 400);

  await call('POST', '/move', { gameId: game.gameId, from: 'e2', to: 'e4' });
  const pgn = await call('GET', `/pgn/${game.gameId}`);
  assert.equal(pgn.status, 200);
  assert.match(pgn.body, /\[White "You"\]/);
  assert.match(pgn.body, /\[Black "ChessMaster Bot \(Level 100, Grandmaster 5\)"\]/);
  assert.match(pgn.body, /1\. e4 /);
});

test('checkmate is reported and further moves are refused', async () => {
  const { body: game } = await call('POST', '/newgame', {});
  // Set up fool's mate directly on the stored game: 1. f3 e5 2. g4 Qh4#
  const stored = getGame(game.gameId);
  for (const san of ['f3', 'e5', 'g4', 'Qh4#']) stored.chess.move(san);

  const { body: state } = await call('GET', `/game/${game.gameId}`);
  assert.equal(state.status.isCheckmate, true);
  assert.equal(state.status.result, '0-1');
  assert.equal((await call('POST', '/move', { gameId: game.gameId, from: 'a2', to: 'a3' })).status, 400);
});

test('unknown game returns 404', async () => {
  assert.equal((await call('GET', '/game/nope')).status, 404);
});
