/**
 * Chooses the bot's move for a position at a given difficulty.
 */
import { engine } from './engine.js';

/** Converts UCI ("e7e8q") into the object chess.js expects. */
export function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/**
 * Fallback used only if Stockfish is unavailable: prefer checkmates, then
 * captures of the most valuable piece, then checks, otherwise random.
 */
function simpleMove(chess) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const moves = chess.moves({ verbose: true });
  const score = (m) => (m.san.includes('#') ? 100 : 0) + (values[m.captured] ?? 0) * 2 + (m.san.includes('+') ? 1 : 0) + Math.random();
  return moves.sort((a, b) => score(b) - score(a))[0];
}

function randomMove(chess) {
  const moves = chess.moves({ verbose: true });
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * @param {import('chess.js').Chess} chess  position to move in (not modified)
 * @param {object} level  entry from DIFFICULTIES
 * @returns {Promise<{from: string, to: string, promotion?: string}>}
 */
export async function chooseBotMove(chess, level) {
  if (Math.random() < level.randomChance) {
    return randomMove(chess);
  }
  try {
    const { bestMove } = await engine.bestMove(chess.fen(), level);
    return uciToMove(bestMove);
  } catch (err) {
    console.error('[bot] Stockfish failed, using fallback move:', err.message);
    return simpleMove(chess);
  }
}

/** Strongest move we can find, for hints. */
export async function findBestMove(chess) {
  try {
    const { bestMove } = await engine.bestMove(chess.fen(), { skill: 20, depth: 12, movetimeMs: 800 });
    return uciToMove(bestMove);
  } catch (err) {
    console.error('[hint] Stockfish failed, using fallback move:', err.message);
    return simpleMove(chess);
  }
}
