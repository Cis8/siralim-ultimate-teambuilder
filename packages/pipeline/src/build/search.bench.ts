import {
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  initialExploreState,
  type ExploreState,
  type SearchService,
} from '@atlas/core';
import { beforeAll, test } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// SPEC §Performance: a search and the recount of the facets take at most 16 ms per keystroke on a mid-range phone, with
// the full dataset. This times them on the pinned snapshot of the compendium, v2.0 (1,780 traits), on the machine that
// runs it (`pnpm bench`, which prints a table per search). It holds no budget: the check that does, on a CPU slowed down 4×
// and in the page, is the e2e `typing-latency.test.ts`. This is for finding out where the time goes when that one fails.

const TYPED = '(vulnerable OR weak) -stack:no';

/** What the query bar holds after each key of `text`, as the page searches it. */
const keystrokes = (text: string): ExploreState[] =>
  Array.from(text, (_, length) => ({ ...initialExploreState, query: text.slice(0, length + 1) }));

const scenarios: Record<string, ExploreState> = {
  'no query: every trait, every facet counted': initialExploreState,
  'one word': { ...initialExploreState, query: 'vulnerable' },
  'a query with a field, an OR and a NOT': { ...initialExploreState, query: TYPED },
  'a query that finds nothing': { ...initialExploreState, query: 'no trait says this' },
  'filters: two classes, two keywords, both flags': {
    ...initialExploreState,
    classes: ['life', 'nature'],
    keywords: [
      { field: 'applies', key: 'vulnerable' },
      { field: 'uses', key: 'weak' },
    ],
    keywordMode: 'any',
    artifactEligible: true,
    doesNotStack: true,
  },
  'sorted by class': { ...initialExploreState, sort: 'class' },
};

let service: SearchService;

beforeAll(async () => {
  const built = await buildRealSheet();
  service = await createSearchService(
    createMemoryTraitRepository({
      schemaVersion: DATASET_SCHEMA_VERSION,
      datasetVersion: built.datasetVersion,
      traits: built.traits,
    }),
  );
});

for (const [name, state] of Object.entries(scenarios)) {
  test(`search: ${name}`, async ({ bench }) => {
    await bench(name, () => {
      service.search(state);
    }).run();
  });
}

test(`search: typing ${TYPED}, one search per key`, async ({ bench }) => {
  const typing = keystrokes(TYPED);

  await bench(`typing ${String(typing.length)} keys`, () => {
    for (const state of typing) service.search(state);
  }).run();
});
