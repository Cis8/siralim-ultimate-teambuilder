import { expect, test } from '@playwright/test';
import { SEARCH_MEASURE } from '../src/lib/search-timing';
import { announcedCount, format, openExplore, publishedCount, searchBox } from './support/explore-page';
import {
  BUDGET_MS,
  collectMeasures,
  CPU_SLOWDOWN,
  describeTimings,
  KEY_DELAY_MS,
  percentile,
  slowDownCpu,
} from './support/timings';

// Acceptance criterion 9 (docs/ROADMAP.md) and SPEC §Performance: with the full dataset, the search and the recount of the
// facets take at most 16 ms per keystroke on a mid-range phone. The CPU is slowed down 4× (what Lighthouse calls a mobile
// profile) and a person's typing is replayed key by key; the page times every search it makes (`timeSearches`), and the
// test reads the measures from the timeline. The rest of a keystroke, the update of the list, is bounded by the list being
// virtualised (`virtual-list.svelte`) and is not part of the budget. The query assist has a budget of its own
// (`assist-latency.test.ts`).

/** The query of criterion 1: a word, then an OR and a NOT, so that the keys go through every shape of search. */
const TYPED = '(vulnerable OR weak) -stack:no';

test.describe('typing in the query bar on the full dataset', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'The CPU is slowed down through the DevTools protocol.');

  test(`searches in under ${String(BUDGET_MS)} ms, 95 keys in 100, with a CPU ${String(CPU_SLOWDOWN)}× slower`, async ({
    page,
  }) => {
    await openExplore(page);
    const total = await publishedCount(page);
    expect(total).toBeGreaterThan(1500);
    const durations = await collectMeasures(page, SEARCH_MEASURE);
    await slowDownCpu(page);

    await searchBox(page).pressSequentially(TYPED, { delay: KEY_DELAY_MS });

    // The keys searched the dataset, and each key was timed once.
    await expect(announcedCount(page)).not.toHaveText(new RegExp(`^${format(total)} of`));
    const timings = await durations.jsonValue();
    expect(timings).toHaveLength(TYPED.length);
    test.info().annotations.push({
      type: 'search',
      description: describeTimings(timings),
    });
    expect(percentile(timings, 0.95)).toBeLessThan(BUDGET_MS);
  });
});
