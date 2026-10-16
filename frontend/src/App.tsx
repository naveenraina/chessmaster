import { useChessGame } from './hooks/useChessGame';
import { Board } from './components/Board';
import { CapturedPieces, materialScore } from './components/CapturedPieces';
import { Controls } from './components/Controls';
import { MoveHistory } from './components/MoveHistory';
import { StatusBanner } from './components/StatusBanner';

export default function App() {
  const chess = useChessGame();
  const { game } = chess;

  const player = game?.playerColor ?? 'w';
  const bot = player === 'w' ? 'b' : 'w';
  const playerCaptured = game?.captured[player] ?? [];
  const botCaptured = game?.captured[bot] ?? [];
  const lead = materialScore(playerCaptured) - materialScore(botCaptured);
  const level = chess.difficulties.find((d) => d.id === game?.difficulty);

  return (
    <div className="app">
      <header className="app-header">
        <h1>♞ ChessMaster</h1>
        <p>Play chess against a friendly robot!</p>
      </header>

      <main className="layout">
        <div className="board-column">
          <StatusBanner chess={chess} />
          <CapturedPieces
            label={`${level?.emoji ?? '🤖'} ${level?.name ?? 'Bot'}`}
            pieces={botCaptured}
            capturedColor={player}
            advantage={-lead}
          />
          <Board chess={chess} />
          <CapturedPieces label="🧒 You" pieces={playerCaptured} capturedColor={bot} advantage={lead} />
        </div>

        <aside className="side-column">
          <Controls chess={chess} />
          <MoveHistory moves={game?.moves ?? []} />
        </aside>
      </main>
    </div>
  );
}
