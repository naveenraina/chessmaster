/** Unicode chess glyphs and point values, shared by several components. */
import type { Color, PieceSymbol } from '../types';

const GLYPHS: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function pieceGlyph(piece: string, color: Color): string {
  return GLYPHS[color][piece as PieceSymbol] ?? '';
}
