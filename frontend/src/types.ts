/** Shapes returned by the backend API. */

export type Color = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** A group of levels, e.g. "Beginner" = levels 1-20. */
export interface Tier {
  id: string;
  name: string;
  emoji: string;
  from: number;
  to: number;
  description: string;
}

export interface Difficulty {
  id: number;
  name: string;
  emoji: string;
  tier: string;
  description: string;
}

export interface DifficultyList {
  tiers: Tier[];
  levels: Difficulty[];
}

export interface GameStatus {
  isGameOver: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  reason: string | null;
}

export interface MoveSummary {
  san: string;
  from: string;
  to: string;
  color: Color;
}

export interface GameState {
  gameId: string;
  fen: string;
  pgn: string;
  turn: Color;
  playerColor: Color;
  difficulty: number;
  moves: MoveSummary[];
  lastMove: { from: string; to: string } | null;
  /** Pieces captured BY each colour. */
  captured: Record<Color, PieceSymbol[]>;
  botComment: string | null;
  status: GameStatus;
}

export interface Hint {
  from: string;
  to: string;
  san: string;
  explanation: string;
}
