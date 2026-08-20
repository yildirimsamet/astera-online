import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Everything is served same-origin in dev, through this proxy.
 *
 * The refresh token is an httpOnly, SameSite=Lax cookie. Talking to the API on
 * another origin would mean SameSite=None plus CORS credentials — a weaker cookie
 * and two more things to get wrong — for no benefit in a single-deployment game.
 */
const API = process.env.ASTERA_API ?? 'http://localhost:3100';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Reachable from a phone on the same network — this game is played in gaps,
    // standing up, on a small screen. Testing it on a desktop only is testing
    // something else.
    host: true,
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
        // SSE must not be buffered by the dev proxy or the return moment arrives
        // in one lump when the connection closes.
        ws: false,
      },
    },
  },
  build: { target: 'es2022' },
});
