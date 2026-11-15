import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/siega-total/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Some tests generate and validate dozens of levels; the CI runners take about twice as long as a laptop.
    testTimeout: 15_000,
  },
});
