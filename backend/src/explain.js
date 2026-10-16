/**
 * Turns a chess.js move into a short, child-friendly sentence.
 * Used for the bot's move commentary and for hints.
 */
const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/**
 * @param {import('chess.js').Move} move  verbose move from chess.js
 * @param {{ isCheckmate?: boolean }} [after]  facts about the position after the move
 */
export function explainMove(move, after = {}) {
  const piece = PIECE_NAMES[move.piece];
  const parts = [];

  if (move.isKingsideCastle?.() || move.isQueensideCastle?.()) {
    parts.push('Castling! The king tucks away safely and the rook joins the game.');
  } else {
    parts.push(`The ${piece} moves from ${move.from} to ${move.to}`);
    if (move.captured) {
      parts[0] += move.isEnPassant?.()
        ? ' and captures a pawn en passant (a special pawn capture)!'
        : ` and captures a ${PIECE_NAMES[move.captured]}!`;
    } else {
      parts[0] += '.';
    }
  }

  if (move.promotion) {
    parts.push(`The pawn reached the last row and becomes a ${PIECE_NAMES[move.promotion]}!`);
  }
  if (after.isCheckmate) {
    parts.push('Checkmate — the king has no escape!');
  } else if (move.san.includes('+')) {
    parts.push('Check! The king is under attack.');
  } else if (!move.captured && !move.promotion && ['n', 'b'].includes(move.piece) && ['1', '8'].includes(move.from[1])) {
    parts.push('Developing a piece toward the center is a great idea in the opening.');
  } else if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
    parts.push('This pawn fights for the center of the board.');
  }

  return parts.join(' ');
}
