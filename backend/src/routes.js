/**
 * REST API routes. All routes are mounted under /api by server.js.
 *
 *   GET  /difficulties   list of bot levels
 *   POST /newgame        { difficulty?, playerColor? }             -> game
 *   POST /move           { gameId, from, to, promotion? }          -> game (+ bot reply)
 *   POST /difficulty     { gameId, difficulty }                    -> game
 *   POST /undo           { gameId }                                -> game
 *   GET  /hint/:gameId                                             -> { from, to, san, explanation }
 *   GET  /game/:gameId                                             -> game
 *   GET  /pgn/:gameId                                              -> PGN file download
 */
import { Router } from 'express';
import { Chess } from 'chess.js';
import { DEFAULT_DIFFICULTY, getDifficulty, listDifficulties } from './difficulty.js';
import { createGame, getGame, serializeGame, updatePgnHeaders } from './gameStore.js';
import { chooseBotMove, findBestMove } from './bot.js';
import { explainMove } from './explain.js';

export const router = Router();

/** Wraps async handlers so thrown errors reach the error middleware. */
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireGame(id) {
  const game = getGame(id);
  if (!game) throw new HttpError(404, 'Game not found. Please start a new game.');
  return game;
}

/** Plays the bot's reply if it is the bot's turn and the game is still going. */
async function playBotMoveIfNeeded(game) {
  const { chess } = game;
  if (chess.isGameOver() || chess.turn() === game.playerColor) return;

  const choice = await chooseBotMove(chess, getDifficulty(game.difficulty));
  const move = chess.move(choice);
  game.botComment = explainMove(move, { isCheckmate: chess.isCheckmate() });
}

router.get('/difficulties', (_req, res) => {
  res.json(listDifficulties());
});

router.post('/newgame', asyncRoute(async (req, res) => {
  const difficulty = getDifficulty(req.body?.difficulty ?? DEFAULT_DIFFICULTY);
  if (!difficulty) throw new HttpError(400, 'Unknown difficulty level.');
  const playerColor = req.body?.playerColor === 'b' ? 'b' : 'w';

  const game = createGame({ difficulty: difficulty.id, playerColor });
  await playBotMoveIfNeeded(game); // bot opens when the player chose black
  res.status(201).json(serializeGame(game));
}));

router.post('/move', asyncRoute(async (req, res) => {
  const { gameId, from, to, promotion } = req.body ?? {};
  const game = requireGame(gameId);
  const { chess } = game;

  if (chess.isGameOver()) throw new HttpError(400, 'The game is already over.');
  if (chess.turn() !== game.playerColor) throw new HttpError(409, "Please wait — it's the bot's turn.");

  // chess.js enforces every rule (check, castling, en passant, promotion...).
  // It throws on an illegal move, which we turn into a friendly 400.
  try {
    chess.move({ from, to, promotion: promotion ?? 'q' });
  } catch {
    throw new HttpError(400, "That move isn't allowed. Try another one!");
  }
  game.botComment = null;

  await playBotMoveIfNeeded(game);
  res.json(serializeGame(game));
}));

router.post('/difficulty', (req, res) => {
  const game = requireGame(req.body?.gameId);
  const level = getDifficulty(req.body?.difficulty);
  if (!level) throw new HttpError(400, 'Unknown difficulty level.');
  game.difficulty = level.id;
  updatePgnHeaders(game);
  res.json(serializeGame(game));
});

router.post('/undo', (req, res) => {
  const game = requireGame(req.body?.gameId);
  const { chess } = game;
  // Take back moves until it's the player's turn again (normally the bot's
  // reply plus the player's move), but never undo past the bot's opening move.
  const minPlies = game.playerColor === 'b' ? 1 : 0;
  do {
    if (chess.history().length <= minPlies) break;
    chess.undo();
  } while (chess.turn() !== game.playerColor);
  game.botComment = null;
  res.json(serializeGame(game));
});

router.get('/hint/:gameId', asyncRoute(async (req, res) => {
  const game = requireGame(req.params.gameId);
  const { chess } = game;
  if (chess.isGameOver() || chess.turn() !== game.playerColor) {
    throw new HttpError(400, 'No hint available right now.');
  }
  const best = await findBestMove(chess);
  // Play the move on a copy to describe it without touching the real game.
  const copy = new Chess(chess.fen());
  const move = copy.move(best);
  res.json({ from: move.from, to: move.to, san: move.san, explanation: explainMove(move, { isCheckmate: copy.isCheckmate() }) });
}));

router.get('/game/:gameId', (req, res) => {
  res.json(serializeGame(requireGame(req.params.gameId)));
});

router.get('/pgn/:gameId', (req, res) => {
  const game = requireGame(req.params.gameId);
  serializeGame(game); // refreshes the Result header
  res.type('application/x-chess-pgn');
  res.attachment(`chessmaster-${new Date().toISOString().slice(0, 10)}.pgn`);
  res.send(game.chess.pgn() + '\n');
});

/** Turns thrown errors into JSON responses. */
export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
}
