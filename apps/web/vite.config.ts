import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// three.js + react-three are only needed by the 3D flight (loaded lazily); React goes into its own
// chunk so the first screen does not download three.js.
const chunkOf = (id: string) => {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(three|@react-three|three-[\w-]+|troika[\w-]*|maath|meshline|camera-controls|stats-gl|@monogrid|@mediapipe|hls\.js|suspend-react|its-fine|react-use-measure)\//.test(id)) return 'three';
  if (/node_modules\/(react|react-dom|scheduler|zustand|use-sync-external-store)\//.test(id)) return 'react';
  return undefined;
};

// GitHub Pages serves the game from https://<owner>.github.io/nasa-challenge-2026/ :
// `vite build --mode pages` (see .github/workflows/pages.yml) builds for that sub-path.
// Every other build (dev server, Docker + Caddy) stays at the site root.
// Code must load public files via import.meta.env.BASE_URL, never with a leading '/'.
const PAGES_BASE = '/nasa-challenge-2026/';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? PAGES_BASE : '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: chunkOf } },
  },
}));
