/**
 * All game state and server communication lives here, so components only
 * deal with rendering.
 *
 * The server is the source of truth. A local chess.js copy is used to
 * validate moves instantly, highlight legal moves, and show the player's move
 * on the board right away while the bot is thinking (an optimistic update).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { api } from '../api/client';
import type { Color, Difficulty, GameState, Hint, Tier } from '../types';

const STORAGE_KEY = 'chessmaster:v1';

interface Saved {
  gameId?: string;
  difficulty: number;
  playerColor: Color;
}

function loadSaved(): Saved {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { difficulty: 1, playerColor: 'w', ...parsed };
  } catch {
    return { difficulty: 1, playerColor: 'w' };
  }
}

function save(data: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode) – resuming just won't work */
  }
}

export function useChessGame() {
  const [game, setGame] = useState<GameState | null>(null);
  /** Position shown on the board; can run ahead of `game.fen` while the bot thinks. */
  const [displayFen, setDisplayFen] = useState(new Chess().fen());
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [settings, setSettings] = useState(() => {
    const { difficulty, playerColor } = loadSaved();
    return { difficulty, playerColor };
  });
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Applies a fresh server state. */
  const applyGame = useCallback((next: GameState) => {
    setGame(next);
    setDisplayFen(next.fen);
    setHint(null);
    save({ gameId: next.gameId, difficulty: next.difficulty, playerColor: next.playerColor });
  }, []);

  /** Runs an API call with the "thinking" flag and friendly error handling. */
  const run = useCallback(async (task: () => Promise<GameState | void>) => {
    setThinking(true);
    setError(null);
    try {
      const result = await task();
      if (result) applyGame(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setThinking(false);
    }
  }, [applyGame]);

  const newGame = useCallback(
    (difficulty = settings.difficulty, playerColor = settings.playerColor) => {
      setSettings({ difficulty, playerColor });
      return run(() => api.newGame(difficulty, playerColor));
    },
    [run, settings],
  );

  const started = useRef(false); // StrictMode runs effects twice in dev

  // On first load: fetch the level list and resume the previous game if the
  // server still has it, otherwise start a new one.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .difficulties()
      .then((list) => {
        setTiers(list.tiers);
        setDifficulties(list.levels);
      })
      .catch(() => setError("Can't reach the chess server. Is it running?"));
    const saved = loadSaved();
    run(async () => {
      if (saved.gameId) {
        try {
          return await api.getGame(saved.gameId);
        } catch {
          /* expired – fall through to a new game */
        }
      }
      return api.newGame(saved.difficulty, saved.playerColor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Local chess.js instance for the position currently on the board. */
  const board = useMemo(() => new Chess(displayFen), [displayFen]);

  const isPlayersTurn = !!game && !thinking && !game.status.isGameOver && board.turn() === game.playerColor;

  const legalTargets = useCallback(
    (from: string): string[] =>
      isPlayersTurn ? board.moves({ square: from as Square, verbose: true }).map((m) => m.to) : [],
    [board, isPlayersTurn],
  );

  /** True when moving from→to is a pawn reaching the last rank. */
  const needsPromotion = useCallback(
    (from: string, to: string) =>
      board.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.promotion),
    [board],
  );

  /**
   * Plays the player's move. Returns false if it's not legal so the board can
   * snap the piece back.
   */
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!game || !isPlayersTurn) return false;
      const preview = new Chess(displayFen);
      try {
        preview.move({ from, to, promotion: promotion ?? 'q' });
      } catch {
        return false;
      }
      setDisplayFen(preview.fen()); // show the move immediately
      setHint(null);
      const before = game.fen;
      run(async () => {
        try {
          return await api.move(game.gameId, from, to, promotion);
        } catch (err) {
          setDisplayFen(before); // server refused – put the piece back
          throw err;
        }
      });
      return true;
    },
    [game, isPlayersTurn, displayFen, run],
  );

  const undo = useCallback(() => game && run(() => api.undo(game.gameId)), [game, run]);

  const changeDifficulty = useCallback(
    (difficulty: number) => {
      setSettings((s) => ({ ...s, difficulty }));
      if (game) run(() => api.setDifficulty(game.gameId, difficulty));
    },
    [game, run],
  );

  const requestHint = useCallback(async () => {
    if (!game || !isPlayersTurn) return;
    setThinking(true);
    setError(null);
    try {
      setHint(await api.hint(game.gameId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hint available.');
    } finally {
      setThinking(false);
    }
  }, [game, isPlayersTurn]);

  return {
    game,
    displayFen,
    difficulties,
    tiers,
    settings,
    setSettings,
    thinking,
    hint,
    error,
    isPlayersTurn,
    inCheck: board.isCheck(),
    turn: board.turn() as Color,
    legalTargets,
    needsPromotion,
    pieceColorAt: (square: string) => board.get(square as Square)?.color ?? null,
    makeMove,
    newGame,
    undo,
    changeDifficulty,
    requestHint,
    clearError: () => setError(null),
  };
}

export type ChessGame = ReturnType<typeof useChessGame>;
