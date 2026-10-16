/**
 * Shows the pieces one side has captured, plus their material lead
 * (pawn = 1, knight/bishop = 3, rook = 5, queen = 9).
 */
import type { Color, PieceSymbol } from '../types';
import { PIECE_VALUES, pieceGlyph } from './pieces';

interface Props {
  label: string;
  /** Pieces this side has captured (they belong to the other colour). */
  pieces: PieceSymbol[];
  capturedColor: Color;
  /** Material lead over the opponent; only shown when positive. */
  advantage: number;
}

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

export function CapturedPieces({ label, pieces, capturedColor, advantage }: Props) {
  const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return (
    <div className="captured">
      <span className="captured-label">{label}</span>
      <span className="captured-pieces" aria-label={`${label} captured ${pieces.length} pieces`}>
        {sorted.length === 0 ? <span className="muted">nothing yet</span> : sorted.map((p, i) => <span key={i}>{pieceGlyph(p, capturedColor)}</span>)}
      </span>
      {advantage > 0 && <span className="advantage">+{advantage}</span>}
    </div>
  );
}

export function materialScore(pieces: PieceSymbol[]): number {
  return pieces.reduce((sum, p) => sum + PIECE_VALUES[p], 0);
}
