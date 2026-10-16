/**
 * ChessMaster API server.
 *
 * Environment variables:
 *   PORT            port to listen on (default 3001)
 *   CORS_ORIGIN     allowed frontend origin(s), comma separated (default: any)
 *   STOCKFISH_PATH  optional path to a native Stockfish binary
 */
import { app } from './app.js';
import { engine } from './engine.js';

const PORT = Number(process.env.PORT) || 3001;

// Warm up the engine so the first bot move is quick.
engine.start().then(
  () => console.log('[stockfish] engine ready'),
  (err) => console.error('[stockfish] could not start, bot will use a simple fallback:', err.message),
);

const server = app.listen(PORT, () => {
  console.log(`ChessMaster API listening on http://localhost:${PORT}`);
});

function shutdown() {
  engine.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
