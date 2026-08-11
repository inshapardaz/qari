import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: resolve(__dirname),
  // GitHub Pages serves project sites from /<repo>/, so the built demo
  // needs a matching base path; the dev server keeps serving from '/'.
  base: command === 'build' ? '/qari/' : '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
}));
