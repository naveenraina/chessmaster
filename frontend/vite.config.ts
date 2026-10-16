import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development, /api requests are proxied to the Express backend so the
// frontend can use relative URLs. In production set VITE_API_URL instead.
//   API_PROXY_TARGET  where the backend runs (docker-compose.dev.yml sets http://backend:3001)
//   VITE_USE_POLLING  watch files by polling; needed for Docker bind mounts on Windows/macOS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
  },
});
