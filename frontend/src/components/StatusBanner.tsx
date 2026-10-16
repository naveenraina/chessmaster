/** Friendly message above the board: whose turn, check, game result, bot comment, hint. */
import type { ChessGame } from '../hooks/useChessGame';

export function StatusBanner({ chess }: { chess: ChessGame }) {
  const { game, thinking, hint, error, inCheck, turn } = chess;
  const nextLevel = game ? chess.difficulties.find((d) => d.id === game.difficulty + 1) : undefined;

  let tone = 'info';
  let message: string;
  let playerWon = false;

  if (!game) {
    message = 'Setting up the board…';
  } else if (game.status.isGameOver) {
    playerWon =
      (game.status.result === '1-0' && game.playerColor === 'w') || (game.status.result === '0-1' && game.playerColor === 'b');
    if (game.status.isCheckmate) {
      tone = playerWon ? 'win' : 'lose';
      message = playerWon ? '🏆 Checkmate! You won! Amazing job!' : "🤖 Checkmate — the bot won this time. Let's try again!";
    } else {
      tone = 'draw';
      message = `🤝 It's a draw (${game.status.reason}). Well played!`;
    }
  } else if (thinking && turn !== game.playerColor) {
    message = '🤔 The bot is thinking…';
  } else if (thinking) {
    message = '⏳ One moment…';
  } else if (inCheck) {
    tone = 'warn';
    message = '⚠️ Check! Your king is under attack — protect it!';
  } else {
    message = '👉 Your turn! Drag a piece or tap it to see where it can go.';
  }

  return (
    <div className="status-area" aria-live="polite">
      <div className={`status status-${tone}`}>
        {message}
        {playerWon && nextLevel && (
          <div>
            <button className="level-up" onClick={() => chess.newGame(nextLevel.id)}>
              ⬆️ Ready for Level {nextLevel.id}? ({nextLevel.emoji} {nextLevel.name})
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="status status-error" role="alert">
          {error}
          <button className="link" onClick={chess.clearError} aria-label="Dismiss">✕</button>
        </div>
      )}
      {hint ? (
        <div className="bubble hint-bubble">💡 <strong>Hint: {hint.san}.</strong> {hint.explanation}</div>
      ) : (
        game?.botComment && !game.status.isGameOver && <div className="bubble">🤖 {game.botComment}</div>
      )}
    </div>
  );
}
