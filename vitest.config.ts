import { defineConfig } from 'vitest/config';

// Unit tests only; e2e lives in apps/web/e2e and runs with Playwright.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: 'packages/core', include: ['src/**/*.test.ts'] } },
      { test: { name: 'pipeline', root: 'packages/pipeline', include: ['src/**/*.test.ts'] } },
      { test: { name: 'web', root: 'apps/web', include: ['src/**/*.test.ts'] } },
      { test: { name: 'tools', root: 'tools', include: ['**/*.test.ts'] } },
    ],
  },
});
