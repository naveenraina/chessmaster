/**
 * The interactive chessboard.
 *
 * Supports both drag-and-drop and tap-to-move (tap a piece, then tap a
 * square), which is much easier for small hands on a phone or tablet.
 * Highlights: selected piece, legal moves (dots / rings), the last move,
 * a king in check, and the hint move.
 */
import { useState, type CSSProperties } from 'react';
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs, type PieceHandlerArgs } from 'react-chessboard';
import type { ChessGame } from '../hooks/useChessGame';
import { PromotionPicker } from './PromotionPicker';

const COLORS = {
  light: '#fdf3d8',
  dark: '#9fc7a1',
  selected: 'rgba(80, 160, 255, 0.55)',
  lastMove: 'rgba(255, 214, 64, 0.55)',
  hint: 'rgba(60, 200, 120, 0.7)',
  check: 'radial-gradient(circle, rgba(255, 60, 60, 0.9) 0%, rgba(255, 60, 60, 0.4) 55%, transparent 75%)',
  dot: 'radial-gradient(circle, rgba(40, 60, 90, 0.35) 22%, transparent 24%)',
  ring: 'radial-gradient(circle, transparent 58%, rgba(40, 60, 90, 0.35) 60%)',
};

export function Board({ chess }: { chess: ChessGame }) {
  const { game, displayFen, hint, isPlayersTurn, inCheck, turn } = chess;
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const playerColor = game?.playerColor ?? 'w';
  const targets = selected ? chess.legalTargets(selected) : [];

  /** Moves, asking which piece to promote to when a pawn reaches the end. */
  function tryMove(from: string, to: string): boolean {
    setSelected(null);
    if (!chess.legalTargets(from).includes(to)) return false;
    if (chess.needsPromotion(from, to)) {
      setPendingPromotion({ from, to });
      return false; // snap back for now; the move happens after the picker
    }
    return chess.makeMove(from, to);
  }

  function onSquareClick({ square }: SquareHandlerArgs) {
    if (selected && targets.includes(square)) {
      tryMove(selected, square);
    } else if (isPlayersTurn && chess.pieceColorAt(square) === playerColor) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare || sourceSquare === targetSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  }

  const canDragPiece = ({ piece }: PieceHandlerArgs) => isPlayersTurn && piece.pieceType[0] === playerColor;

  // Build the per-square highlight styles. Later entries win.
  const squareStyles: Record<string, CSSProperties> = {};
  if (game?.lastMove && displayFen === game.fen) {
    squareStyles[game.lastMove.from] = { background: COLORS.lastMove };
    squareStyles[game.lastMove.to] = { background: COLORS.lastMove };
  }
  if (inCheck) {
    const kingSquare = findKing(displayFen, turn);
    if (kingSquare) squareStyles[kingSquare] = { background: COLORS.check };
  }
  if (hint) {
    squareStyles[hint.from] = { background: COLORS.hint };
    squareStyles[hint.to] = { background: COLORS.hint };
  }
  if (selected) squareStyles[selected] = { background: COLORS.selected };
  for (const t of targets) {
    const occupied = chess.pieceColorAt(t) !== null;
    squareStyles[t] = { ...squareStyles[t], backgroundImage: occupied ? COLORS.ring : COLORS.dot };
  }

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          id: 'chessmaster-board',
          position: displayFen,
          boardOrientation: playerColor === 'w' ? 'white' : 'black',
          onPieceDrop,
          onSquareClick,
          onPieceDrag: ({ square }) => setSelected(square),
          canDragPiece,
          squareStyles,
          arrows: hint ? [{ startSquare: hint.from, endSquare: hint.to, color: 'rgba(30, 160, 90, 0.85)' }] : [],
          allowDrawingArrows: false,
          animationDurationInMs: 250,
          lightSquareStyle: { backgroundColor: COLORS.light },
          darkSquareStyle: { backgroundColor: COLORS.dark },
          boardStyle: { borderRadius: '14px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(40, 60, 90, 0.25)' },
        }}
      />
      {pendingPromotion && (
        <PromotionPicker
          color={playerColor}
          onPick={(piece) => {
            chess.makeMove(pendingPromotion.from, pendingPromotion.to, piece);
            setPendingPromotion(null);
          }}
          onCancel={() => setPendingPromotion(null)}
        />
      )}
    </div>
  );
}

/** Finds the square of `color`'s king in a FEN string. */
function findKing(fen: string, color: 'w' | 'b'): string | null {
  const king = color === 'w' ? 'K' : 'k';
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        if (ch === king) return 'abcdefgh'[file] + (8 - r);
        file++;
      }
    }
  }
  return null;
}
