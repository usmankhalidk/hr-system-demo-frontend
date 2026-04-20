import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Target Safari explicitly so esbuild (dev) and rollup (build) emit
  // compatible code for iOS Safari's smaller call-stack and JS engine quirks.
  build: {
    target: ['es2020', 'safari14'],
  },
  esbuild: {
    target: 'safari14',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
