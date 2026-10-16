/** Lets the player choose what a pawn turns into when it reaches the last row. */
import type { Color } from '../types';
import { pieceGlyph } from './pieces';

const CHOICES = [
  { piece: 'q', name: 'Queen' },
  { piece: 'r', name: 'Rook' },
  { piece: 'b', name: 'Bishop' },
  { piece: 'n', name: 'Knight' },
] as const;

interface Props {
  color: Color;
  onPick: (piece: string) => void;
  onCancel: () => void;
}

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promotion-overlay" role="dialog" aria-label="Choose a piece" onClick={onCancel}>
      <div className="promotion-card" onClick={(e) => e.stopPropagation()}>
        <h3>Your pawn made it! 🎉</h3>
        <p>Pick a new piece:</p>
        <div className="promotion-choices">
          {CHOICES.map(({ piece, name }) => (
            <button key={piece} onClick={() => onPick(piece)} title={name}>
              <span className="glyph">{pieceGlyph(piece, color)}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
