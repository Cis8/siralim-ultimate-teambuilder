import {
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  descriptionParts,
  initialExploreState,
  type SearchService,
  type Trait,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// The result list draws each description from the keyword spans of the dataset and the marks of the query (SPEC §8.1).
// These hold on the pinned snapshot of the compendium, v2.0, so that the page can trust them.

describe('the descriptions of the compendium v2.0 as the result list draws them', () => {
  let traits: readonly Trait[];
  let service: SearchService;

  beforeAll(async () => {
    const built = await buildRealSheet();
    traits = built.traits;
    service = await createSearchService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits,
      }),
    );
  });

  it('has keyword spans inside the description, in order, apart and never empty', () => {
    for (const { id, description, keywords } of traits) {
      let end = 0;
      for (const {
        key,
        span: [start, stop],
      } of keywords) {
        expect(start, `${id}: ${key}`).toBeGreaterThanOrEqual(end);
        expect(stop, `${id}: ${key}`).toBeGreaterThan(start);
        end = stop;
      }
      expect(end, id).toBeLessThanOrEqual(description.length);
    }
  });

  it.each(['vulnerable', 'the', '"start of battle" OR enemies', 'desc:a', 'ç', '-weak'])(
    'reads back as the description whatever the query marks (%s)',
    (query) => {
      const { highlight } = service.search({ ...initialExploreState, query });
      let marked = 0;

      for (const { id, description, keywords } of traits) {
        const parts = descriptionParts(description, keywords, highlight(description));
        expect(parts.flatMap(({ pieces }) => pieces.map(({ text }) => text)).join(''), id).toBe(description);
        marked += parts.flatMap(({ pieces }) => pieces.filter(({ marked: isMarked }) => isMarked)).length;
      }

      // `ç` and `-weak` mark nothing: the others find their text in the compendium.
      if (query !== 'ç' && query !== '-weak') expect(marked).toBeGreaterThan(0);
    },
  );
});
