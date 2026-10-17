import { defineConfig } from 'vitest/config';

// Unit tests only; e2e lives in apps/web/e2e and runs with Playwright.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: 'packages/core', include: ['src/**/*.test.ts'] } },
      {
        test: {
          name: 'pipeline',
          root: 'packages/pipeline',
          include: ['src/**/*.test.ts'],
          // Sorting reads a function of core through the module runner once per comparison, which Vitest warns can skew a
          // result. A search that sorts is only measured a little slower here than in the page: the warning is no news.
          benchmark: { suppressExportGetterWarnings: true },
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          include: ['src/**/*.test.ts'],
          // Vitest hands every stylesheet over empty, `?raw` ones too: the contrast test reads the tokens as text.
          css: { include: [/tokens\.css/] },
        },
      },
      { test: { name: 'tools', root: 'tools', include: ['**/*.test.ts'] } },
    ],
  },
});
