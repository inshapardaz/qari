import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    globals: true,
    // Several property-based (fast-check) tests run 100 iterations of real
    // rendering/parsing work and land close to the 5s default, which turns
    // into flaky timeouts under parallel worker contention (e.g. in CI).
    testTimeout: 15000,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
