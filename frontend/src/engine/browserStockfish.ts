/**
 * OPTIONAL: run Stockfish directly in the browser with WebAssembly.
 *
 * The app uses the backend engine by default. This module shows how to run
 * the engine client-side instead (offline play, zero server cost). It is not
 * wired into the UI; see "Stockfish in the browser" in the README for how to
 * use it from useChessGame.
 *
 * Setup: copy the engine files into /public so Vite serves them as-is:
 *   npm i stockfish
 *   cp node_modules/stockfish/bin/stockfish-19-lite-single.* public/stockfish/
 *
 * The engine runs inside a Web Worker and speaks UCI via postMessage, so the
 * UI never freezes while it thinks.
 */
export class BrowserStockfish {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private ready: Promise<void>;

  constructor(scriptUrl = '/stockfish/stockfish-19-lite-single.js') {
    this.worker = new Worker(scriptUrl);
    this.worker.onmessage = (e: MessageEvent<string>) => {
      for (const listener of [...this.listeners]) listener(String(e.data));
    };
    this.ready = (async () => {
      this.send('uci');
      await this.waitFor((l) => l === 'uciok');
      this.send('isready');
      await this.waitFor((l) => l === 'readyok');
    })();
  }

  /** Returns the best move in UCI notation (e.g. "e2e4"). */
  async bestMove(fen: string, { skill = 5, depth = 8, movetimeMs = 500 } = {}): Promise<string> {
    await this.ready;
    this.send(`setoption name Skill Level value ${skill}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth} movetime ${movetimeMs}`);
    const line = await this.waitFor((l) => l.startsWith('bestmove'));
    return line.split(' ')[1];
  }

  terminate() {
    this.worker.terminate();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (predicate(line)) {
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
    });
  }
}
