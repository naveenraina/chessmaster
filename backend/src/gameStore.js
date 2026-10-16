/**
 * In-memory game storage.
 *
 * Each game holds a chess.js instance (the source of truth for the rules) plus
 * a few settings. Games idle for longer than GAME_TTL_MS are dropped. Swap this
 * module for SQLite/Postgres if games need to survive a server restart.
 */
import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { getDifficulty } from './difficulty.js';

const GAME_TTL_MS = 6 * 60 * 60 * 1000;
const games = new Map();

export function createGame({ difficulty, playerColor }) {
  const id = randomUUID();
  const chess = new Chess();
  const game = { id, chess, difficulty, playerColor, botComment: null, lastAccess: Date.now() };
  updatePgnHeaders(game);
  games.set(id, game);
  return game;
}

export function getGame(id) {
  const game = games.get(id);
  if (game) game.lastAccess = Date.now();
  return game ?? null;
}

/** Keeps the PGN header names in sync with the player's colour and bot level. */
export function updatePgnHeaders(game) {
  const level = getDifficulty(game.difficulty);
  const botName = `ChessMaster Bot (Level ${level.id}, ${level.name})`;
  const { chess } = game;
  chess.setHeader('Event', 'ChessMaster practice game');
  chess.setHeader('Site', 'ChessMaster');
  chess.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
  chess.setHeader('White', game.playerColor === 'w' ? 'You' : botName);
  chess.setHeader('Black', game.playerColor === 'b' ? 'You' : botName);
}

/** Captured pieces, grouped by the colour that did the capturing. */
function capturedPieces(chess) {
  const captured = { w: [], b: [] };
  for (const move of chess.history({ verbose: true })) {
    if (move.captured) captured[move.color].push(move.captured);
  }
  return captured;
}

function gameStatus(chess) {
  const status = {
    isGameOver: chess.isGameOver(),
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
    result: null,
    reason: null,
  };
  if (status.isCheckmate) {
    status.result = chess.turn() === 'w' ? '0-1' : '1-0';
    status.reason = 'checkmate';
  } else if (status.isDraw) {
    status.result = '1/2-1/2';
    if (status.isStalemate) status.reason = 'stalemate';
    else if (chess.isInsufficientMaterial()) status.reason = 'insufficient material';
    else if (chess.isThreefoldRepetition()) status.reason = 'threefold repetition';
    else status.reason = '50-move rule';
  }
  return status;
}

/** Plain JSON view of a game that is sent to the client. */
export function serializeGame(game) {
  const { chess } = game;
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  const status = gameStatus(chess);
  if (status.result) chess.setHeader('Result', status.result);
  else chess.removeHeader('Result');

  return {
    gameId: game.id,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    playerColor: game.playerColor,
    difficulty: game.difficulty,
    moves: history.map((m) => ({ san: m.san, from: m.from, to: m.to, color: m.color })),
    lastMove: last ? { from: last.from, to: last.to } : null,
    captured: capturedPieces(chess),
    botComment: game.botComment,
    status,
  };
}

// Periodically forget abandoned games so memory doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - GAME_TTL_MS;
  for (const [id, game] of games) {
    if (game.lastAccess < cutoff) games.delete(id);
  }
}, 15 * 60 * 1000).unref();
