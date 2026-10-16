/**
 * Thin wrapper around the backend REST API.
 *
 * In development VITE_API_URL is empty and requests go to /api on the Vite dev
 * server, which proxies them to Express (see vite.config.ts).
 */
import type { Color, DifficultyList, GameState, Hint } from '../types';

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  difficulties: () => request<DifficultyList>('/difficulties'),
  newGame: (difficulty: number, playerColor: Color) => post<GameState>('/newgame', { difficulty, playerColor }),
  move: (gameId: string, from: string, to: string, promotion?: string) =>
    post<GameState>('/move', { gameId, from, to, promotion }),
  setDifficulty: (gameId: string, difficulty: number) => post<GameState>('/difficulty', { gameId, difficulty }),
  undo: (gameId: string) => post<GameState>('/undo', { gameId }),
  hint: (gameId: string) => request<Hint>(`/hint/${gameId}`),
  getGame: (gameId: string) => request<GameState>(`/game/${gameId}`),
  pgnUrl: (gameId: string) => `${API_BASE}/pgn/${gameId}`,
};
