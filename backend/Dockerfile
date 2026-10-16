# ChessMaster API: Express + Stockfish (WASM build from the `stockfish` npm package).
# The engine runs under Node, so no native Stockfish binary is needed.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

# Install dependencies first so this layer is cached until package*.json change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Run as the unprivileged user that ships with the node image.
USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
