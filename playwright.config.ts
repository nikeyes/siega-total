import { defineConfig } from '@playwright/test';

const PORT = 4173;

/** Plays the built game in the installed Chrome, drawing WebGL in software, so it runs the same on a laptop and in CI. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  // Software WebGL draws a few frames a second, so game time runs slowly.
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/siega-total/`,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
