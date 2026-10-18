import { expect, test } from '@playwright/test';
import { ASSIST_MEASURE } from '../src/lib/search-timing';
import { issuesBadge, openExplore, publishedCount, searchBox } from './support/explore-page';
import {
  BUDGET_MS,
  collectMeasures,
  CPU_SLOWDOWN,
  describeTimings,
  KEY_DELAY_MS,
  percentile,
  slowDownCpu,
} from './support/timings';

// Acceptance criterion 7 (docs/ROADMAP.md) and ADR-0010: the query assist, timed as `atlas:assist` (today the lint; later the
// suggestions and their counts), takes at most 16 ms per keystroke beside the search, with the CPU slowed down 4× and the full
// dataset. The text typed has every kind of fault, so the keys go through the rules that are dearest: a field that does not
// exist, a value that is not one, a keyword and an actor that nobody has, a word no trait contains, and a group left open.

const TYPED =
  'clas:life creature:zzzzzz applies:vulnrable uses:attack/nobody mat:maybe weak/self "no trait says this" (snared OR ';

test.describe('the query assist while typing on the full dataset', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'The CPU is slowed down through the DevTools protocol.');

  test(`works out the issues in under ${String(BUDGET_MS)} ms, 95 keys in 100, with a CPU ${String(CPU_SLOWDOWN)}× slower`, async ({
    page,
  }) => {
    await openExplore(page);
    expect(await publishedCount(page)).toBeGreaterThan(1500);
    const durations = await collectMeasures(page, ASSIST_MEASURE);
    await slowDownCpu(page);

    await searchBox(page).pressSequentially(TYPED, { delay: KEY_DELAY_MS });

    // The keys were linted for real: the text has more faults than the panel lists.
    await expect(issuesBadge(page)).toHaveText(/\d+ issues/);
    const timings = await durations.jsonValue();
    // Each key lints once; the focus that starts the typing does too, since it puts a caret in the field.
    expect(timings.length).toBeGreaterThanOrEqual(TYPED.length);
    test.info().annotations.push({ type: 'assist', description: describeTimings(timings) });
    expect(percentile(timings, 0.95)).toBeLessThan(BUDGET_MS);
  });
});
