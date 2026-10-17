import { expect, test, type Page } from '@playwright/test';
import { SEARCH_MEASURE } from '../src/lib/search-timing';
import { announcedCount, format, openExplore, publishedCount, searchBox } from './support/explore-page';

// Acceptance criterion 9 (docs/ROADMAP.md) and SPEC §Performance: with the full dataset, the search and the recount of the
// facets take at most 16 ms per keystroke on a mid-range phone. The CPU is slowed down 4× (what Lighthouse calls a mobile
// profile) and a person's typing is replayed key by key; the page times every search it makes (`timeSearches`), and the
// test reads the measures from the timeline. The rest of a keystroke, the update of the list, is bounded by the list being
// virtualised (`virtual-list.svelte`) and is not part of the budget.

const CPU_SLOWDOWN = 4;
const BUDGET_MS = 16;

/** The query of criterion 1: a word, then an OR and a NOT, so that the keys go through every shape of search. */
const TYPED = '(vulnerable OR weak) -stack:no';
/** A person types a key about every 100 ms at the fastest. */
const KEY_DELAY_MS = 120;

/** Collects the duration of every search the page makes from now on, one per key; the array is live. */
function collectSearchTimes(page: Page) {
  return page.evaluateHandle((name) => {
    const durations: number[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntriesByName(name)) durations.push(entry.duration);
    }).observe({ type: 'measure' });
    return durations;
  }, SEARCH_MEASURE);
}

/** The value `share` of the way up the sorted samples (the nearest rank). */
const percentile = (samples: readonly number[], share: number): number => {
  const sorted = samples.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.ceil(share * sorted.length)) - 1] ?? Number.NaN;
};

test.describe('typing in the query bar on the full dataset', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'The CPU is slowed down through the DevTools protocol.');

  test(`searches in under ${String(BUDGET_MS)} ms, 95 keys in 100, with a CPU ${String(CPU_SLOWDOWN)}× slower`, async ({
    page,
  }) => {
    await openExplore(page);
    const total = await publishedCount(page);
    expect(total).toBeGreaterThan(1500);
    const durations = await collectSearchTimes(page);
    const cpu = await page.context().newCDPSession(page);
    await cpu.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    await searchBox(page).pressSequentially(TYPED, { delay: KEY_DELAY_MS });

    // The keys searched the dataset, and each key was timed once.
    await expect(announcedCount(page)).not.toHaveText(new RegExp(`^${format(total)} of`));
    const timings = await durations.jsonValue();
    expect(timings).toHaveLength(TYPED.length);
    test.info().annotations.push({
      type: 'search',
      description: `p50 ${percentile(timings, 0.5).toFixed(1)} ms, p95 ${percentile(timings, 0.95).toFixed(1)} ms, max ${Math.max(...timings).toFixed(1)} ms`,
    });
    expect(percentile(timings, 0.95)).toBeLessThan(BUDGET_MS);
  });
});
