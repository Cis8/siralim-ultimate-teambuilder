// Lighthouse CI on the built site: `pnpm build`, then `pnpm lighthouse` (from the folder this file is in). The default
// emulation, a phone on a slow 4G network with a 4× slower CPU, is the demanding one. The build is served from the root,
// so it is made without BASE_PATH. The sizes of the files are `pnpm size-budget`'s business, not this one's.
const { chromium } = require('@playwright/test');

// Lighthouse CI's own static server cannot do what GitHub Pages does for the Synergy pages (`/synergy` is `synergy.html`, a trait's
// page is answered by `404.html`), so the build is served by tools/serve-build. The page of a trait is the one whose lists are
// the longest (67 alternatives); a trait that the sheet renames would show "Trait not found", which still scores, so the e2e
// (`synergy-trait.test.ts`) is what notices the id has gone.
const PORT = 4174;
const origin = `http://localhost:${String(PORT)}`;

// The median of the runs: one slow run neither fails the build nor hides a regression.
const aggregationMethod = 'median';

// What every page owes, whatever its performance: measured on 2026-10-19 as 1 / 1 / 1 on all four.
// Accessibility is a requirement (DESIGN § Accessibility): no margin.
const everyPage = {
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 0.95 }],
  // Explore used to jump when the traits arrived (0.75), and the Synergy pages when their lists did (0.12); "good" is up to 0.1.
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: `tsx ../../tools/serve-build/serve-build.ts build ${String(PORT)}`,
      startServerReadyPattern: 'Serving',
      url: [
        `${origin}/`,
        `${origin}/synergy`,
        `${origin}/synergy/effigy--jungle-boogie`,
        `${origin}/synergy/kw/vulnerable`,
      ],
      numberOfRuns: 3,
      // The Chromium the e2e uses, so that the scores do not move with whatever Chrome a machine has.
      chromePath: chromium.executablePath(),
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertMatrix: [
        {
          // Explore and the picker, which are in the HTML before the script runs. Measured on 2026-10-19: performance 0.90 and 0.96.
          matchingUrlPattern: '/(synergy)?$',
          aggregationMethod,
          assertions: { ...everyPage, 'categories:performance': ['error', { minScore: 0.85 }] },
        },
        {
          // The page of a trait and of a keyword are drawn after the dataset is there (the route has no server render, ADR-0011), so
          // their LCP is the whole waterfall: 3.5 s and performance 0.87 and 0.89 on 2026-10-19, which a slower runner would push
          // under 0.85 for no fault of the code. Their layout shift is held to the same 0.1 and measured 0.
          matchingUrlPattern: '/synergy/.',
          aggregationMethod,
          assertions: { ...everyPage, 'categories:performance': ['error', { minScore: 0.8 }] },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci' },
  },
};
