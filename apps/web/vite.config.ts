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

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: chunkOf } },
  },
});
