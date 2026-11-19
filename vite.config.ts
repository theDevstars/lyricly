import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri serves the dev server on a fixed port so the shell can point at it.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome110',
    minify: 'esbuild',
    sourcemap: false,
  },
});
