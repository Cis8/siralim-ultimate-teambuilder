import {
  createMemoryTraitRepository,
  createRelationIndex,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  initialExploreState,
  taxonomy,
  type ExploreState,
  type KeywordView,
  type RelationIndex,
  type RelationOptions,
  type SearchService,
  type Trait,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the keyword view (Phase 2, M12.4) says on the pinned snapshot of the compendium, v2.0: the counts Explore shows, and the
// verdict of every key, which is committed (`snapshots/keyword-verdicts-v2.0.txt`) so that a change to the data, the taxonomy or
// the overrides that moves a verdict shows up as a line to read. After an intended change: `pnpm exec vitest run -u`.

describe('the keyword view on the compendium v2.0', () => {
  let traits: readonly Trait[];
  let index: RelationIndex;
  let service: SearchService;

  const viewOf = (key: string, options?: RelationOptions): KeywordView => {
    const found = index.keywordView(key, options);
    if (found === undefined) throw new Error(`the index has no key "${key}"`);
    return found;
  };
  const names = (list: readonly Trait[]) => list.map(({ name }) => name);

  beforeAll(async () => {
    const built = await buildRealSheet();
    traits = built.traits;
    index = createRelationIndex(traits, taxonomy);
    service = await createSearchService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits,
      }),
    );
  });

  describe('agreement with Explore (criterion 11)', () => {
    const states: readonly [string, ExploreState, RelationOptions][] = [
      ['all traits', initialExploreState, {}],
      ['traits with material', { ...initialExploreState, artifactEligible: true }, { artifactOnly: true }],
    ];

    it.each(states)('has as many appliers and users as the facet panel counts, for %s', (_name, state, options) => {
      const panel = service.search(state).facets.keywords;

      for (const key of index.keys) {
        const facet = panel.find((one) => one.key === key);
        expect(facet, key).toBeDefined();
        expect(viewOf(key, options).stats.appliers, `applies:${key}`).toBe(facet?.applies);
        expect(viewOf(key, options).stats.users, `uses:${key}`).toBe(facet?.uses);
      }
    });

    it.each(states)('counts the chips as the facet panel does, for %s', (_name, state, options) => {
      const panel = service.search(state).facets.keywords;
      const chips = index.keywordStats(options);

      expect([...chips.keys()]).toEqual(index.keys);
      for (const key of index.keys) {
        expect(chips.get(key)?.appliers, `applies:${key}`).toBe(panel.find((one) => one.key === key)?.applies);
        expect(chips.get(key)?.users, `uses:${key}`).toBe(panel.find((one) => one.key === key)?.uses);
      }
    });

    it('lists the traits a search for `applies:` and `uses:` finds', () => {
      for (const key of index.keys) {
        const found = (side: 'applies' | 'uses') =>
          service.search({ ...initialExploreState, query: `${side}:${key}` }).traits.map(({ id }) => id);

        expect(
          viewOf(key)
            .appliers.map(({ id }) => id)
            .toSorted(),
          `applies:${key}`,
        ).toEqual(found('applies').toSorted());
        expect(
          viewOf(key)
            .users.map(({ id }) => id)
            .toSorted(),
          `uses:${key}`,
        ).toEqual(found('uses').toSorted());
      }
    });
  });

  describe('the verdicts', () => {
    it('are committed for every key, with and without the filter: key | verdict | A C R U | with material only', async () => {
      const line = (key: string) => {
        const [everything, withMaterial] = [viewOf(key), viewOf(key, { artifactOnly: true })];
        const counts = ({ stats }: KeywordView) =>
          `${stats.appliers} ${stats.conditional} ${stats.random} ${stats.users}`;
        return `${key} | ${everything.verdict} | ${counts(everything)} | ${withMaterial.verdict} | ${counts(withMaterial)}`;
      };

      await expect(`${index.keys.map(line).join('\n')}\n`).toMatchFileSnapshot(
        '../../snapshots/keyword-verdicts-v2.0.txt',
      );
    });
  });

  describe('keys often applied together', () => {
    const together = (key: string, options?: RelationOptions) =>
      viewOf(key, options).coApplied.map(({ key: other, count }) => `${other} ${count}`);

    it('lists for Poisoned Bleeding and Burning first, three appliers each, then the keys one applier shares, in taxonomy order', () => {
      expect(together('poisoned')).toEqual([
        'bleeding 3',
        'burning 3',
        'blighted 1',
        'bomb 1',
        'cursed 1',
        'frozen 1',
        'silenced 1',
        'leeching 1',
        'mending 1',
      ]);
    });

    it('works them out of the appliers with material when asked: The Black has none, and it applied three of those keys', () => {
      const theBlack = traits.find(({ name }) => name === 'The Black');

      expect(theBlack?.material).toBeNull();
      expect(names(viewOf('poisoned').appliers)).toContain('The Black');
      expect(names(viewOf('poisoned', { artifactOnly: true }).appliers)).not.toContain('The Black');
      expect(together('poisoned', { artifactOnly: true })).toEqual([
        'bleeding 3',
        'burning 3',
        'bomb 1',
        'cursed 1',
        'frozen 1',
        'silenced 1',
      ]);
    });

    it('ties Weak and Vulnerable through Master of Abominations, which applies both', () => {
      expect(names(viewOf('weak').appliers)).toEqual(['Master of Abominations', 'Scourge']);
      expect(together('weak')).toEqual(['vulnerable 1']);
      expect(together('vulnerable')).toEqual(['cursed 1', 'stoned 1', 'weak 1']);
    });

    it('has nothing for the keys whose appliers apply nothing else', () => {
      for (const key of ['barrier', 'zombies', 'inverted']) expect(together(key), key).toEqual([]);
    });

    it('is as large from one key as from the other: the traits that apply both are the same', () => {
      for (const key of index.keys) {
        for (const { key: other, count } of viewOf(key).coApplied) {
          expect(viewOf(other).coApplied.find((back) => back.key === key)?.count, `${key} and ${other}`).toBe(count);
        }
      }
    });
  });
});
