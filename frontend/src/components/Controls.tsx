/** Game buttons: hint, undo, new game, PGN export, difficulty and colour pickers. */
import { api } from '../api/client';
import type { ChessGame } from '../hooks/useChessGame';
import type { Color } from '../types';
import { LevelPicker } from './LevelPicker';

export function Controls({ chess }: { chess: ChessGame }) {
  const { game, settings, thinking, isPlayersTurn } = chess;
  const canUndo = !!game && !thinking && game.moves.length > (game.playerColor === 'b' ? 1 : 0);

  return (
    <section className="panel controls">
      <div className="button-row">
        <button className="btn btn-hint" onClick={chess.requestHint} disabled={!isPlayersTurn}>
          💡 Hint
        </button>
        <button className="btn btn-undo" onClick={chess.undo} disabled={!canUndo}>
          ↩️ Undo
        </button>
        <button className="btn btn-new" onClick={() => chess.newGame()} disabled={thinking}>
          🔄 New game
        </button>
      </div>

      <h2>🎚️ Bot level</h2>
      <LevelPicker chess={chess} />

      <h2>🎨 Play as</h2>
      <div className="color-pick" role="radiogroup" aria-label="Your colour for the next game">
        {(['w', 'b'] as Color[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={settings.playerColor === c}
            className={`level ${settings.playerColor === c ? 'active' : ''}`}
            onClick={() => chess.newGame(settings.difficulty, c)}
            disabled={thinking}
          >
            {c === 'w' ? '⚪ White (go first)' : '⚫ Black'}
          </button>
        ))}
      </div>

      {game && (
        <a className="btn btn-pgn" href={api.pgnUrl(game.gameId)} download>
          💾 Save game (PGN)
        </a>
      )}
    </section>
  );
}
