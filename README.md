# ♞ ChessMaster

A child-friendly web app for playing chess against a Stockfish bot.

- **Frontend:** React 19 + TypeScript + Vite, `react-chessboard` for the board, `chess.js` for instant move validation and legal-move highlights
- **Backend:** Node.js + Express, `chess.js` as the rules authority, Stockfish 19 (WASM build from the `stockfish` npm package) running as a child process

## Features

| Feature | How |
|---|---|
| Drag-and-drop **and** tap-to-move | Tap-to-move is easier for small hands on tablets and phones |
| Legal-move highlights | Dots for empty squares, rings for captures; the king's square turns red when in check |
| 100 difficulty levels in 7 tiers | 🐣 Beginner → 👑 Grandmaster. ◀ ▶ step one level at a time, and a "Ready for Level N?" button appears after a win (see [Difficulty](#how-difficulty-works)) |
| Full rule enforcement | Checked on the client for instant feedback, and again on the server, which has the final say |
| Undo, New game, Play as White/Black | Undo takes back your move and the bot's reply |
| Hints | Stockfish's best move, shown as a green arrow with a plain-English explanation |
| Bot commentary | Every bot move is explained ("The knight moves from g8 to f6. Developing a piece…") |
| Captured pieces and material score | Shown above and below the board, e.g. `+3` |
| PGN export | "Save game (PGN)" downloads a file that opens in Lichess, Chess.com, etc. |
| Pawn promotion picker | Choose a queen, rook, bishop or knight |
| Resume after refresh | The game id is kept in `localStorage` |

## Project structure

```
ChessMaster/
├── package.json              # convenience scripts (install:all, start, test)
├── docker-compose.yml        # production stack (see "Deployment with Docker")
├── docker-compose.https.yml  # optional HTTPS via Caddy
├── docker-compose.dev.yml    # live-reload dev stack
├── backend/
│   ├── src/
│   │   ├── server.js         # entry point: starts Express and warms up Stockfish
│   │   ├── app.js            # Express app (middleware + routes), importable by tests
│   │   ├── routes.js         # REST endpoints
│   │   ├── engine.js         # Stockfish UCI wrapper (child process + request queue)
│   │   ├── bot.js            # picks the bot's move for a difficulty; fallback if the engine fails
│   │   ├── difficulty.js     # level definitions
│   │   ├── gameStore.js      # in-memory games + JSON serialization
│   │   └── explain.js        # child-friendly move descriptions
│   └── test/api.test.js      # end-to-end API tests against real Stockfish
└── frontend/
    ├── vite.config.ts        # proxies /api → http://localhost:3001 in dev
    └── src/
        ├── App.tsx           # page layout
        ├── App.css           # all styling (responsive)
        ├── api/client.ts     # typed REST client
        ├── hooks/useChessGame.ts   # game state, optimistic moves, server calls
        ├── components/
        │   ├── Board.tsx           # react-chessboard + highlights + tap/drag logic
        │   ├── PromotionPicker.tsx
        │   ├── CapturedPieces.tsx
        │   ├── MoveHistory.tsx
        │   ├── StatusBanner.tsx
        │   ├── Controls.tsx
        │   ├── LevelPicker.tsx     # tier tabs + numbered level grid
        │   └── pieces.ts
        └── engine/browserStockfish.ts   # optional: Stockfish in a Web Worker (not wired in)
```

## Running locally

Requires **Node.js 20.19+** (tested on 22).

```bash
npm run install:all
```

```bash
npm start
```

This starts the API on http://localhost:3001 and the app on **http://localhost:5173**. Open the second URL.

To run the two parts separately, use two terminals:

```bash
cd backend && npm install && npm start
```

```bash
cd frontend && npm install && npm start
```

Run the backend tests (these use the real engine):

```bash
npm test
```

### Backend environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `CORS_ORIGIN` | any origin | Comma-separated list of allowed frontend origins (set this in production) |
| `STOCKFISH_PATH` | bundled WASM engine | Path to a native Stockfish binary, which is faster than WASM |

### Frontend environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL for production builds, e.g. `https://chessmaster-api.onrender.com`. Leave it empty in development so Vite's proxy is used. |

## API

All routes are under `/api`. Each game endpoint returns the full game state: `fen`, `pgn`, `moves`, `lastMove`, `captured`, `status` (check, checkmate, draw, result), `botComment`, `turn`, `playerColor` and `difficulty`.

| Method | Route | Body | Notes |
|---|---|---|---|
| `GET` | `/difficulties` | | Level list for the UI |
| `POST` | `/newgame` | `{ difficulty?: 1-100, playerColor?: "w" \| "b" }` | If the player is black, the bot makes the first move |
| `POST` | `/move` | `{ gameId, from, to, promotion? }` | Validates the move, then plays the bot's reply in the same response. Illegal moves get a `400` with a friendly message |
| `POST` | `/difficulty` | `{ gameId, difficulty }` | Takes effect from the bot's next move |
| `POST` | `/undo` | `{ gameId }` | Takes moves back until it's the player's turn again |
| `GET` | `/hint/:gameId` | | `{ from, to, san, explanation }` |
| `GET` | `/game/:gameId` | | Current state (used to resume after a refresh) |
| `GET` | `/pgn/:gameId` | | Downloads a `.pgn` file |

Example:

```bash
curl -X POST localhost:3001/api/move -H "Content-Type: application/json" -d '{"gameId":"<id>","from":"e2","to":"e4"}'
```

## How difficulty works

Even at Stockfish's lowest "Skill Level" it plays far better than a beginner. The lower levels therefore also play a **random legal move** some of the time, which produces the kind of blunders a child can learn to punish.

There are **100 levels in 7 tiers**. Each level's settings are calculated from its number in `backend/src/difficulty.js`, so strength rises smoothly with no jumps:

| Tier | Levels | Skill (0-20) | Depth | Random-move chance |
|---|---|---|---|---|
| 🐣 Beginner | 1–20 | 0 → 2 | 1 → 2 | 60% → 33% |
| 🐰 Novice | 21–35 | 3 → 5 | 3 → 4 | 32% → 17% |
| 🦊 Intermediate | 36–55 | 5 → 9 | 5 → 8 | 16% → 1% |
| 🦉 Advanced | 56–70 | 9 → 13 | 8 → 11 | 1% → 0% (none from level 60) |
| 🦁 Expert | 71–85 | 13 → 16 | 11 → 14 | 0% |
| 🐉 Master | 86–95 | 16 → 19 | 15 → 17 | 0% |
| 👑 Grandmaster | 96–100 | 19 → 20 | 17 → 18 | 0% (level 100 is full-strength Stockfish) |

Thinking time also rises, from 0.1 s at level 1 to 1.5 s at level 100. The tier names are labels for the child; they are not chess ratings.

- **To retune strength**, change the curves in `buildLevel()`. Raise `LAST_RANDOM_LEVEL` to keep random blunders going into higher levels.
- **To resize the tiers**, edit `from`/`to` in `TIERS`. `MAX_LEVEL` sets the total number of levels.
- `backend/test/difficulty.test.js` checks that the tiers have no gaps and that no level is weaker than the one below it.
- The UI builds its picker from `GET /api/difficulties`, so it needs no changes.

## How the Stockfish integration works (server)

`backend/src/engine.js` starts Stockfish once as a child process: `node node_modules/stockfish/bin/stockfish-19-lite-single.js`. It then talks to it with the text-based [UCI protocol](https://backscattering.de/chess/uci/):

```
→ setoption name Skill Level value 3
→ position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
→ go depth 3 movetime 200
← info depth 1 ... score cp -30 ...
← bestmove e7e5
```

UCI is a single conversation, so requests from different games are queued and handled one at a time. If the engine crashes, it restarts on the next request. While it is down, `bot.js` falls back to a simple capture-first move picker so the game never gets stuck.

## Stockfish in the browser (WASM)

You can run the engine entirely in the browser instead. That allows offline play and needs no backend for the bot. `frontend/src/engine/browserStockfish.ts` is a ready-made wrapper.

1. Copy the engine into `public/` so Vite serves it unchanged. The `.js` and `.wasm` files must sit side by side:
   ```bash
   cd frontend && npm i stockfish
   ```
   ```bash
   mkdir -p public/stockfish && cp node_modules/stockfish/bin/stockfish-19-lite-single.* public/stockfish/
   ```
2. Use it from the hook:
   ```ts
   import { BrowserStockfish } from '../engine/browserStockfish';
   const engine = new BrowserStockfish(); // starts a Web Worker, so the UI never freezes

   const uci = await engine.bestMove(chess.fen(), { skill: 3, depth: 3, movetimeMs: 200 });
   chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
   ```
3. Notes:
   - Use the **single-threaded** build (`-single`). The multi-threaded build needs `SharedArrayBuffer`, which requires the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers on your host.
   - The **lite** build (about 2 MB) loads much faster on phones than the full one (about 100 MB), and it is still far stronger than any child.
   - With a browser engine, the backend becomes optional. You would keep game state in the hook and generate the PGN locally with `chess.pgn()`.

## Deployment with Docker (recommended)

The whole app runs as two containers on any machine with Docker: your PC, a home server, or a small cloud VPS (1 vCPU / 1 GB RAM is plenty).

```
browser ──► frontend container (nginx :80)
              ├── /         → built React app
              └── /api/...  → backend container (Express + Stockfish :3001, private)
```

The browser only ever talks to nginx. The API isn't published to the outside, and because everything comes from one origin, no CORS setup is needed.

| File | Purpose |
|---|---|
| `docker-compose.yml` | Production: builds both images and serves the app on port 8080 |
| `docker-compose.https.yml` | Optional add-on: Caddy in front for automatic HTTPS on a real domain |
| `docker-compose.dev.yml` | Development with live reload; nothing to install but Docker |
| `backend/Dockerfile` | `node:22-alpine`, production dependencies only, runs as a non-root user, has a health check |
| `frontend/Dockerfile` | Builds with Node, then serves with `nginx:1.27-alpine` |
| `frontend/nginx.conf.template` | Single-page-app routing, `/api` proxy, long-term caching for hashed assets |

### Run it

```bash
docker compose up -d --build
```

Open **http://localhost:8080**, or `http://<server-ip>:8080` from another device on your network, such as her tablet. To use a different port:

```bash
APP_PORT=3000 docker compose up -d --build
```

Useful commands:

```bash
docker compose ps
```

```bash
docker compose logs -f backend
```

```bash
docker compose down
```

**To update after changing the code**, run `docker compose up -d --build` again. Restarting the backend clears the games in progress, because they are kept in memory. The browser then quietly starts a new game.

### Put it on the internet with HTTPS

1. Rent a small Linux VPS (DigitalOcean, Hetzner, Lightsail, etc.) and [install Docker](https://docs.docker.com/engine/install/).
2. Point a domain's DNS **A record** at the server's IP, and open ports **80** and **443** in its firewall.
3. Copy the project to the server (for example with `git clone`) and run:
   ```bash
   DOMAIN=chess.example.com docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
   ```
   Caddy gets a free Let's Encrypt certificate and renews it automatically. HTTP redirects to HTTPS, and port 8080 is no longer exposed. You can also put `DOMAIN=chess.example.com` in a `.env` file next to the compose files instead of typing it each time.

`restart: unless-stopped` brings the app back after a server reboot. Logs are rotated, with three files of 10 MB per container.

### Develop inside Docker

```bash
docker compose -f docker-compose.dev.yml up
```

The app runs on http://localhost:5173 and the API on http://localhost:3001. The source folders are mounted into the containers: saving a file under `frontend/src` reloads the page, and saving under `backend/src` restarts the API. Both watchers poll for changes, which works on Windows and macOS. The first start takes a minute while `npm ci` runs inside the containers.

### Notes

- **Run one backend container only.** Games live in its memory, so a second replica wouldn't know about them. To scale out, move `gameStore.js` to Postgres or Redis first.
- **Memory:** the backend is limited to 512 MB and uses about 80 MB in practice. Change `deploy.resources.limits` in `docker-compose.yml` if needed.
- **Faster engine:** switch the backend image to `node:22-slim` (Debian), add `RUN apt-get update && apt-get install -y --no-install-recommends stockfish && rm -rf /var/lib/apt/lists/*`, and set `STOCKFISH_PATH: /usr/games/stockfish` in `docker-compose.yml`. The WASM engine is already more than fast enough for the bot levels, so this is only worth it with many players.
- **API on another domain:** build the frontend with `VITE_API_URL` set (a build arg in `docker-compose.yml`), and set `CORS_ORIGIN` on the backend.

## Other hosting options

**Frontend → Netlify** (or Vercel, Cloudflare Pages)

- Base directory: `frontend`, build command: `npm run build`, publish directory: `frontend/dist`
- Environment variable: `VITE_API_URL=https://<your-backend-host>`

**Backend → a host that runs a long-lived Node process**

The backend keeps a Stockfish process and the games in memory. Hosts that run persistent containers therefore suit it best: Render, Railway, Fly.io, or Heroku (a paid Basic dyno; free dynos no longer exist).

- Root directory `backend`, start command `npm start`, and set `CORS_ORIGIN=https://<your-netlify-site>.netlify.app`
- Heroku: add a `Procfile` containing `web: npm start`, then `git subtree push --prefix backend heroku main`
- **Vercel serverless functions are a poor fit for this backend.** Each request may hit a fresh instance, so in-memory games vanish and the engine cold-starts on every move. If you want Vercel, use the browser-WASM engine instead and deploy only the frontend.
- For many simultaneous players, set `STOCKFISH_PATH` to a native binary and move `gameStore.js` to SQLite or Postgres. Because the store is a small module (`createGame`, `getGame`), that change stays local.

## Ideas to make it more educational

- **Coach mode:** before the child's move, warn if a piece is hanging. Compare the engine's evaluation before and after the move and say something like "Careful! Your queen can be captured." `engine.js` already parses `score cp` from Stockfish's output.
- **Move grades:** label each move Great / Good / Inaccuracy / Mistake from the evaluation change, with a short "a better move was…" explanation.
- **Puzzles:** load "mate in 1" and "win a piece" positions from the free [Lichess puzzle database](https://database.lichess.org/#puzzles) and play them as mini-games with stars and streaks.
- **Piece lessons:** small levels where only one piece type moves (for example, a rook collecting stars) to teach how each piece moves before full games.
- **Opening names:** show "You're playing the Italian Game!" using the ECO opening database.
- **Game review:** after the game, step through the moves with the best move drawn as an arrow at each turning point.
- **Rewards:** badges such as "First checkmate", "Castled 5 times" or "Beat Knight Explorer", and auto-suggest moving up a level after 3 wins in a row.
- **Read aloud:** the Web Speech API (`speechSynthesis.speak`) can read the bot's comments and hints to younger children.
- **Parent dashboard:** store finished PGNs to show progress over time (games played, win rate per level).

## License

Stockfish is licensed under GPL-3.0, and so is this project's backend, which bundles it. If you distribute the app, you must also offer its source code.
