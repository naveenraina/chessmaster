# ♞ ChessMaster

A child-friendly web app for playing chess against a Stockfish bot.

- **Frontend:** React 19 + TypeScript + Vite, `react-chessboard` for the board, `chess.js` for instant move validation and legal-move highlights
- **Backend:** Node.js + Express, `chess.js` as the rules authority, Stockfish 19 (WASM build from the `stockfish` npm package) running as a child process

## Features

| Feature | How |
|---|---|
| Drag-and-drop **and** tap-to-move | Tap-to-move is easier for small hands on tablets and phones |
| Legal-move highlights | Dots for empty squares, rings for captures; the king's square turns red when in check |
| 500 difficulty levels in 7 tiers | 🐣 Beginner → 👑 Grandmaster. ◀ ▶ step 1 level, « » step 10, a slider picks any level in a tier, and a "Ready for Level N?" button appears after a win (see [Difficulty](#how-difficulty-works)) |
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
├── deploy/iis/               # IIS deployment: deploy.ps1 + web.config templates
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
        │   ├── LevelPicker.tsx     # tier tabs, slider and step buttons
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
| `POST` | `/newgame` | `{ difficulty?: 1-500, playerColor?: "w" \| "b" }` | If the player is black, the bot makes the first move |
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

Even at its weakest setting Stockfish plays far better than a beginner. The lower levels therefore also play a **random legal move** some of the time, which produces the kind of blunders a child can learn to punish.

There are **500 levels in 7 tiers**. Each level's settings are calculated from its number in `backend/src/difficulty.js`, so strength rises smoothly. Strength is limited with Stockfish's `UCI_Elo` option (1320–3190) rather than its "Skill Level", which has only 21 steps and would make most neighbouring levels identical.

| Tier | Levels | Engine Elo setting | Depth | Random-move chance |
|---|---|---|---|---|
| 🐣 Beginner | 1–100 | 1320 → 1588 | 1 → 3 | 60% → 33% |
| 🐰 Novice | 101–175 | 1592 → 1848 | 3 → 5 | 33% → 16% |
| 🦊 Intermediate | 176–275 | 1852 → 2231 | 5 → 8 | 16% → 1.5% |
| 🦉 Advanced | 276–350 | 2235 → 2538 | 8 → 11 | 1.4% → 0% (none from level 299) |
| 🦁 Expert | 351–425 | 2542 → 2858 | 11 → 14 | 0% |
| 🐉 Master | 426–475 | 2862 → 3078 | 14 → 17 | 0% |
| 👑 Grandmaster | 476–500 | 3083 → unlimited | 17 → 18 | 0% (level 500 is full-strength Stockfish) |

Thinking time also rises, from 0.1 s at level 1 to 1.5 s at level 500.

**What to expect:** neighbouring levels differ only slightly; that is the point of having 500. A child will feel a difference over 10–20 levels rather than over 1. The tier names and the engine Elo setting are not real-world ratings: the random moves and depth limits make the low levels much weaker than their Elo number suggests.

- **To retune strength**, change the curves in `buildLevel()`. Raise `LAST_RANDOM_LEVEL` to keep random blunders going into higher levels.
- **To change the number of levels**, set `MAX_LEVEL` and adjust `from`/`to` in `TIERS`. The tests catch gaps.
- `backend/test/difficulty.test.js` checks that the tiers have no gaps, that no level is weaker than the one below it, and that no two neighbouring levels have identical settings.
- The UI builds its picker from `GET /api/difficulties`, so it needs no changes.

## How the Stockfish integration works (server)

`backend/src/engine.js` starts Stockfish once as a child process: `node node_modules/stockfish/bin/stockfish-19-lite-single.js`. It then talks to it with the text-based [UCI protocol](https://backscattering.de/chess/uci/):

```
→ setoption name UCI_LimitStrength value true
→ setoption name UCI_Elo value 1500
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

## Deploying to IIS (Windows, no Docker)

IIS serves the built React app, and runs the Node API as an IIS application at `/api`, all in one site:

```
browser ──► IIS site "ChessMaster" (:8080)
              ├── /         → static files in C:\inetpub\chessmaster
              └── /api/...  → IIS app "api" → HttpPlatformHandler → node.exe (Express + Stockfish)
```

[HttpPlatformHandler](https://www.iis.net/downloads/microsoft/httpplatformhandler) is a Microsoft IIS module that starts `node.exe` when needed and forwards `/api` requests to it. It also restarts Node if it crashes, so you don't need a separate Windows service.

### One-time server setup

1. **Enable IIS.** On Windows 10/11 use *Turn Windows features on or off* → *Internet Information Services*. On Windows Server use Server Manager → *Web Server (IIS)*. The defaults are enough; *Application Initialization* (under Application Development Features) is optional, and lets Node start before the first visitor arrives.
2. **Install the [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite) module.**
3. **Install the [HttpPlatformHandler](https://www.iis.net/downloads/microsoft/httpplatformhandler) module** (x64).
4. **Install [Node.js](https://nodejs.org/) 20.19 or newer** (the LTS installer), then open a new terminal so `node` is on PATH.

### Deploy

Copy the project to the server (or run it on the machine that has IIS). Then, in **PowerShell run as Administrator**, from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\iis\deploy.ps1
```

Open **http://localhost:8080**. The script:

1. checks for IIS, both modules and Node, and stops with a clear message if one is missing;
2. builds the frontend and copies it to `C:\inetpub\chessmaster`, with `deploy/iis/frontend.web.config` as its `web.config`;
3. copies the backend to `C:\inetpub\chessmaster-api`, runs `npm ci --omit=dev`, and writes `deploy/iis/api.web.config` with your Node path;
4. creates the app pools `ChessMaster` and `ChessMaster-api`, the site, and the `/api` application, grants the folder permissions, and unlocks the IIS config sections the API's `web.config` needs (for `/api` only);
5. starts everything and calls `/api/health` to confirm it works.

**To redeploy after changing the code**, run the same command again. It stops the site, copies the new files and starts it again. Games in progress end, because they are kept in memory.

Options:

```powershell
.\deploy\iis\deploy.ps1 -Port 80 -HostName chess.example.com
```

| Parameter | Default | |
|---|---|---|
| `-SiteName` | `ChessMaster` | IIS site name; the app pools are named after it |
| `-Port` | `8080` | Port 80 is usually taken by "Default Web Site"; stop that site or use a host name |
| `-HostName` | *(any)* | Host-name binding, e.g. `chess.example.com` |
| `-SitePath` / `-ApiPath` | `C:\inetpub\chessmaster` / `C:\inetpub\chessmaster-api` | Where the files go |
| `-NodeExe` | `node.exe` on PATH | Use a specific Node installation |
| `-SkipBuild` | off | Reuse an existing `frontend\dist` |

### Reaching it from other devices

To play from a tablet on the same network, open the port in Windows Firewall (as Administrator), then browse to `http://<pc-name-or-ip>:8080`:

```powershell
New-NetFirewallRule -DisplayName "ChessMaster (TCP 8080)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

For **HTTPS**, add an `https` binding with a certificate to the site in IIS Manager. [win-acme](https://www.win-acme.com/) can get and renew free Let's Encrypt certificates for IIS automatically.

### How the API is kept alive

The `ChessMaster-api` app pool is set to **AlwaysRunning**, with **no idle timeout** and **no scheduled recycling**. Otherwise IIS would stop Node after 20 idle minutes, or recycle it every 29 hours, and end the games that live in its memory. When IIS does stop Node, the Stockfish engine process exits with it.

### Troubleshooting

| Symptom | Check |
|---|---|
| The script says a module is missing | Install it (see setup above), then run the script again |
| `/api/...` returns **502.3 / 502.5** | Node didn't start. Read the newest file in `C:\inetpub\chessmaster-api\logs\`, which holds Node's output. |
| `/api/...` returns **500.19** "This configuration section cannot be used at this path" | IIS locks some sections against `web.config` by default. The deploy script unlocks `handlers`, `httpPlatform` and `rewrite/rules` for the `/api` application only. On a site deployed with an older version of the script, run as Administrator: `foreach ($s in 'system.webServer/handlers','system.webServer/httpPlatform','system.webServer/rewrite/rules') { & "$env:SystemRoot\System32\inetsrv\appcmd.exe" unlock config "ChessMaster/api" "-section:$s" -commit:apphost }` |
| `/api/...` returns **500.19** with another message | A module is missing, or `web.config` is malformed. Re-check the URL Rewrite and HttpPlatformHandler installs. |
| The page loads but says it can't reach the server | Open `http://localhost:8080/api/health`, which should return `{"ok":true}` |
| Site won't start | Another site uses the same port and host name. Change `-Port` or `-HostName`. |

**Alternative without HttpPlatformHandler:** run the backend as a Windows service (for example with [WinSW](https://github.com/winsw/winsw) or NSSM) on port 3001. Then install [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing), enable its proxy, and add a URL Rewrite rule that sends `/api/(.*)` to `http://localhost:3001/api/{R:1}`. The frontend `web.config` stays the same.

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
