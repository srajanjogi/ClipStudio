import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  root: __dirname,
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true
  }
});
