// Lighthouse CI on the built site: `pnpm build`, then `pnpm lighthouse` (from the folder this file is in). The default
// emulation, a phone on a slow 4G network with a 4× slower CPU, is the demanding one. The build is served from the root,
// so it is made without BASE_PATH. The sizes of the files are `pnpm size-budget`'s business, not this one's.
const { chromium } = require('@playwright/test');

module.exports = {
  ci: {
    collect: {
      staticDistDir: './build',
      url: ['/'],
      numberOfRuns: 3,
      // The Chromium the e2e uses, so that the scores do not move with whatever Chrome a machine has.
      chromePath: chromium.executablePath(),
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      // The median of the runs: one slow run neither fails the build nor hides a regression.
      aggregationMethod: 'median',
      assertions: {
        // Measured on 2026-10-17: 0.92 / 1 / 1 / 1. Accessibility is a requirement (DESIGN § Accessibility): no margin.
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        // The page used to jump when the traits arrived (0.75); "good" is up to 0.1.
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
