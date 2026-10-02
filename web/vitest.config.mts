import { defineConfig } from 'vitest/config';

// Unit and component tests for the Next app (#598). V8 coverage over real application code;
// the exclusions are listed and justified in docs/decisions/2026-10-01-test-the-web-app-with-vitest-and-playwright.md.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx,mjs}'],
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
    env: { NEXT_PUBLIC_BASE_PATH: '' },
    // CSS Modules resolve to a proxy of their class names, so `styles.x` is a stable string.
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    // The first test of a file that renders a page also pays for loading the corpora; coverage instrumentation slows it further.
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'json', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      include: ['app/**', 'components/**', 'lib/**', 'resolvers/**', 'services/**', 'theme/**'],
      exclude: [
        '**/*.stories.tsx', // Storybook documentation, built and laid out by check:layout; smoke-rendered by the story test
        '**/*.d.ts',
        '**/*.css',
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
