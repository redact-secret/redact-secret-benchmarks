import { defineConfig } from '@playwright/test';

/**
 * Browser tests of the built static export (#598). `npm run build` first; the suite serves web/out
 * with tests/e2e/serve.mjs and drives it in Chrome. `PW_CHANNEL=chrome` uses an installed Google
 * Chrome (as check:layout does); CI installs Playwright's Chromium instead.
 *
 * No retries: a test that passes only on the second run is a bug in the test or the page. A trace is
 * kept for a failure. Output goes to PW_OUTPUT_DIR (default web/test-results, git-ignored).
 */
const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 4 : undefined,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['dot'], ['json', { outputFile: 'test-results/results.json' }]] : [['list']],
  outputDir: process.env.PW_OUTPUT_DIR ?? 'test-results',
  expect: { timeout: 10_000 },
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    // Same-origin only; fonts are answered by the fixture, nothing leaves the machine.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: `http://127.0.0.1:${port}/next/report/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
