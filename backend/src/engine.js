/**
 * Stockfish engine wrapper.
 *
 * Runs Stockfish as a child process and talks to it with the UCI protocol over
 * stdin/stdout. By default it runs the WASM build shipped in the `stockfish`
 * npm package (`node node_modules/stockfish/bin/stockfish-19-lite-single.js`),
 * so nothing has to be compiled or installed separately. Set STOCKFISH_PATH to
 * a native Stockfish binary for more speed in production.
 *
 * UCI is a single conversation, so requests are queued and run one at a time.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveEngineCommand() {
  if (process.env.STOCKFISH_PATH) {
    return { cmd: process.env.STOCKFISH_PATH, args: [] };
  }
  // "lite-single" = smaller neural net, single thread: fast startup, low memory,
  // and still far stronger than any child needs.
  const findEngine = require('stockfish/scripts/findEngine.js');
  return { cmd: process.execPath, args: [findEngine('lite-single')] };
}

export class StockfishEngine {
  constructor() {
    this.proc = null;
    this.buffer = '';
    this.lineListeners = new Set();
    this.queue = Promise.resolve();
    this.ready = null;
  }

  /** Starts the engine process (once) and waits for the UCI handshake. */
  start() {
    if (this.ready) return this.ready;

    const { cmd, args } = resolveEngineCommand();
    this.proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => this.#onData(chunk));
    this.proc.stderr.on('data', (d) => console.error('[stockfish]', String(d).trim()));
    this.proc.on('exit', (code) => {
      console.warn(`[stockfish] exited with code ${code}; will restart on next request`);
      this.proc = null;
      this.ready = null;
    });
    this.proc.on('error', (err) => console.error('[stockfish] failed to start:', err.message));

    this.ready = (async () => {
      this.#send('uci');
      await this.#waitFor((line) => line === 'uciok', 15000);
      await this.#isReady();
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  /**
   * Asks the engine for the best move in a position.
   * @param {string} fen
   * @param {{skill?: number, depth?: number, movetimeMs?: number}} opts
   * @returns {Promise<{bestMove: string, scoreCp: number|null, mateIn: number|null}>}
   *          bestMove is UCI notation, e.g. "e2e4" or "e7e8q".
   */
  bestMove(fen, { skill = 20, depth = 12, movetimeMs = 1000 } = {}) {
    return this.#enqueue(async () => {
      await this.start();
      this.#send(`setoption name Skill Level value ${skill}`);
      this.#send('ucinewgame');
      await this.#isReady();

      let scoreCp = null;
      let mateIn = null;
      const onInfo = (line) => {
        const cp = line.match(/ score cp (-?\d+)/);
        const mate = line.match(/ score mate (-?\d+)/);
        if (cp) { scoreCp = Number(cp[1]); mateIn = null; }
        if (mate) { mateIn = Number(mate[1]); scoreCp = null; }
      };
      this.lineListeners.add(onInfo);
      try {
        this.#send(`position fen ${fen}`);
        this.#send(`go depth ${depth} movetime ${movetimeMs}`);
        const line = await this.#waitFor((l) => l.startsWith('bestmove'), movetimeMs + 10000);
        return { bestMove: line.split(/\s+/)[1], scoreCp, mateIn };
      } finally {
        this.lineListeners.delete(onInfo);
      }
    });
  }

  stop() {
    if (this.proc) {
      this.#send('quit');
      this.proc.kill();
    }
  }

  // --- internals -----------------------------------------------------------

  #enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {}); // keep the queue alive after a failure
    return run;
  }

  #send(cmd) {
    this.proc?.stdin.write(cmd + '\n');
  }

  async #isReady() {
    this.#send('isready');
    await this.#waitFor((line) => line === 'readyok', 15000);
  }

  #onData(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();
    for (const line of lines) {
      for (const listener of [...this.lineListeners]) listener(line.trim());
    }
  }

  /** Resolves with the first output line that matches `predicate`. */
  #waitFor(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.lineListeners.delete(listener);
        reject(new Error('Stockfish did not answer in time'));
      }, timeoutMs);
      const listener = (line) => {
        if (predicate(line)) {
          clearTimeout(timer);
          this.lineListeners.delete(listener);
          resolve(line);
        }
      };
      this.lineListeners.add(listener);
    });
  }
}

/** Shared engine instance for the whole server. */
export const engine = new StockfishEngine();
