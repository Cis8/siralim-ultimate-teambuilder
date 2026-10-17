import {
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  FACET_KEYWORD_KINDS,
  initialExploreState,
  taxonomy,
  type ExploreState,
  type KeywordFilter,
  type SearchService,
  type Trait,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// Acceptance criterion 4 (docs/ROADMAP.md) on the pinned snapshot of the compendium, v2.0: "Class facet is any-of;
// keyword facets follow the all/any switch; counts update as filters change". Each answer is compared with one worked
// out another way, from the classes and the keyword hits of the traits, never through the query language.

describe('the Explore filters on the compendium v2.0', () => {
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

  const search = (overrides: Partial<ExploreState> = {}) => service.search({ ...initialExploreState, ...overrides });
  const idsFound = (overrides: Partial<ExploreState> = {}): string[] => search(overrides).traits.map(({ id }) => id);
  const inDatasetOrder = (wanted: (trait: Trait) => boolean): string[] => traits.filter(wanted).map(({ id }) => id);

  const hasHit = (trait: Trait, field: KeywordFilter['field'], key: string): boolean =>
    trait.keywords.some((hit) => hit.key === key && (field === 'kw' || hit.role === field));
  const applies = (key: string) => ({ field: 'applies', key }) as const;

  describe('the class facet', () => {
    it('is any of the classes chosen', () => {
      expect(idsFound({ classes: ['life', 'nature'] })).toEqual(
        inDatasetOrder(({ class: name }) => name === 'Life' || name === 'Nature'),
      );
    });

    it('does not take Nether Boss for Boss', () => {
      const boss = inDatasetOrder(({ class: name }) => name === 'Boss');
      const nether = inDatasetOrder(({ class: name }) => name === 'Nether Boss');

      expect([boss.length, nether.length]).toEqual([10, 105]);
      expect(idsFound({ classes: ['boss'] })).toEqual(boss);
      expect(idsFound({ classes: ['nether boss'] })).toEqual(nether);
      expect(idsFound({ classes: ['boss', 'nether boss'] })).toEqual(
        inDatasetOrder(({ class: name }) => name === 'Boss' || name === 'Nether Boss'),
      );
      expect(search({ classes: ['boss'] }).effectiveQuery).toBe('class:boss -class:"nether boss"');
    });

    it('lists the 11 classes of the compendium: the five of a creature from A to Z, then the others by size', () => {
      expect(search().facets.classes.map(({ name }) => name)).toEqual([
        'Chaos',
        'Death',
        'Life',
        'Nature',
        'Sorcery',
        'Rodian Master',
        'Backer',
        'Nether Boss',
        'Boss',
        'Pandemonium',
        'Nether Room',
      ]);
    });

    it('counts the traits of each class, whichever classes are chosen', () => {
      const everyone = search().facets.classes;

      expect(everyone.reduce((total, { count }) => total + count, 0)).toBe(traits.length);
      for (const { name, count } of everyone) {
        expect(count, name).toBe(traits.filter(({ class: each }) => each === name).length);
      }
      expect(search({ classes: ['life'] }).facets.classes).toEqual(everyone);
      expect(search({ classes: ['life', 'death', 'boss'] }).facets.classes).toEqual(everyone);
    });

    it('counts, as the other filters change, the traits that they leave in each class', () => {
      const filters: Partial<ExploreState>[] = [
        { keywords: [applies('snared')] },
        { keywords: [applies('snared')], classes: ['death'] },
        { artifactEligible: true },
        { doesNotStack: true, artifactEligible: true },
        { query: 'snared' },
      ];
      const leftIn = (overrides: Partial<ExploreState>, name: string): number => {
        const left = search({ ...overrides, classes: [] }).traits;
        return left.filter(({ class: each }) => each === name).length;
      };

      for (const overrides of filters) {
        for (const { name, count } of search(overrides).facets.classes) {
          expect(count, `${name} with ${JSON.stringify(overrides)}`).toBe(leftIn(overrides, name));
        }
      }
      const appliers = traits.filter((trait) => hasHit(trait, 'applies', 'snared'));
      const chaosAppliers = appliers.filter(({ class: name }) => name === 'Chaos');
      const counted = search({ keywords: [applies('snared')], classes: ['life'] }).facets.classes;
      expect(counted.find(({ name }) => name === 'Chaos')?.count).toBe(chaosAppliers.length);
      expect(chaosAppliers.length).toBeGreaterThan(0);
      expect(chaosAppliers.length).toBeLessThan(appliers.length);
    });
  });

  describe('the keyword facets', () => {
    const snared = applies('snared');
    const poisoned = applies('poisoned');
    const appliersOf = (key: string) => inDatasetOrder((trait) => hasHit(trait, 'applies', key));

    it('need every keyword chosen when the mode is all', () => {
      const both = inDatasetOrder(
        (trait) => hasHit(trait, 'applies', 'snared') && hasHit(trait, 'applies', 'poisoned'),
      );

      expect(idsFound({ keywords: [snared, poisoned], keywordMode: 'all' })).toEqual(both);
      expect(both.length).toBeLessThan(appliersOf('snared').length);
    });

    it('need one of them when the mode is any', () => {
      const either = inDatasetOrder(
        (trait) => hasHit(trait, 'applies', 'snared') || hasHit(trait, 'applies', 'poisoned'),
      );

      expect(idsFound({ keywords: [snared, poisoned], keywordMode: 'any' })).toEqual(either);
      expect(either.length).toBeGreaterThan(appliersOf('snared').length);
      expect(either.length).toBeGreaterThan(appliersOf('poisoned').length);
    });

    it('tell what a trait applies from what it relies on, and from any mention', () => {
      for (const field of ['applies', 'uses', 'kw'] as const) {
        expect(idsFound({ keywords: [{ field, key: 'silenced' }] }), field).toEqual(
          inDatasetOrder((trait) => hasHit(trait, field, 'silenced')),
        );
      }
    });

    it('list every buff, debuff, effect, event and mechanic of the taxonomy', () => {
      const listed = search().facets.keywords.map(({ key }) => key);

      expect(listed).toEqual(FACET_KEYWORD_KINDS.flatMap((kind) => taxonomy.ofKind(kind).map(({ key }) => key)));
      expect(listed).toHaveLength(70);
    });

    it('count the traits that apply, rely on and mention each, among those shown', () => {
      for (const overrides of [{}, { classes: ['life'] }, { artifactEligible: true }, { query: 'class:death' }]) {
        const shown = search(overrides).traits;
        for (const facet of search(overrides).facets.keywords) {
          const label = `${facet.key} with ${JSON.stringify(overrides)}`;
          expect(facet.applies, label).toBe(shown.filter((trait) => hasHit(trait, 'applies', facet.key)).length);
          expect(facet.uses, label).toBe(shown.filter((trait) => hasHit(trait, 'uses', facet.key)).length);
          expect(facet.mentions, label).toBe(shown.filter((trait) => hasHit(trait, 'kw', facet.key)).length);
        }
      }
    });

    it('count what criterion 2 found for Vulnerable: 8 appliers, 6 that rely on it', () => {
      const vulnerableFacet = search().facets.keywords.find(({ key }) => key === 'vulnerable');

      expect(vulnerableFacet).toMatchObject({ kind: 'debuff', label: 'Vulnerable', applies: 8, uses: 6 });
    });

    it('change with the filters', () => {
      const countOf = (overrides: Partial<ExploreState>) =>
        search(overrides).facets.keywords.find(({ key }) => key === 'snared')?.applies;

      expect(countOf({})).toBe(12);
      expect(countOf({ classes: ['nature'] })).toBe(5);
      expect(countOf({ classes: ['nature', 'chaos'] })).toBe(7);
      expect(countOf({ classes: ['life'] })).toBe(0);
      expect(countOf({ query: 'zzz-no-such-text' })).toBe(0);
    });
  });

  describe('the flags and the sort', () => {
    it('keep the traits with a material, or that do not stack', () => {
      expect(idsFound({ artifactEligible: true })).toEqual(inDatasetOrder(({ material }) => material !== null));
      expect(idsFound({ doesNotStack: true })).toEqual(inDatasetOrder(({ stacks }) => !stacks));
    });

    it('keep the order of the dataset for book, and sort by name or by class and family otherwise', () => {
      const names = search({ sort: 'az' }).traits.map(({ name }) => name.toLowerCase());
      const byClass = search({ sort: 'class' }).traits.map(({ class: name, family }) => [name, family]);

      expect(idsFound({ sort: 'book' })).toEqual(traits.map(({ id }) => id));
      expect(names).toEqual(names.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
      expect(byClass).toEqual(
        byClass.toSorted(([a1 = '', a2 = ''], [b1 = '', b2 = '']) => {
          const [x, y] = [
            a1.toLowerCase() + '\u0000' + a2.toLowerCase(),
            b1.toLowerCase() + '\u0000' + b2.toLowerCase(),
          ];
          return x < y ? -1 : x > y ? 1 : 0;
        }),
      );
    });
  });

  describe('the effective query', () => {
    const typed = (query: string) => idsFound({ query });

    it('finds, typed in the query bar, what the filters find, for every filter on its own', () => {
      const singles: Partial<ExploreState>[] = [
        ...search().facets.classes.map(({ name }) => ({ classes: [name.toLowerCase()] })),
        ...taxonomy.entries.flatMap(({ key }) =>
          (['applies', 'uses', 'kw'] as const).map((field) => ({ keywords: [{ field, key }] })),
        ),
        { artifactEligible: true },
        { doesNotStack: true },
      ];

      for (const overrides of singles) {
        const { effectiveQuery, traits: found } = search(overrides);
        expect(typed(effectiveQuery), JSON.stringify(overrides)).toEqual(found.map(({ id }) => id));
      }
    });

    it('finds the same traits for a state that uses every part', () => {
      const overrides: Partial<ExploreState> = {
        query: 'snared OR weak',
        classes: ['boss', 'death', 'nether boss'],
        keywords: [applies('weak'), { field: 'kw', key: 'start of battle' }, { field: 'uses', key: 'vulnerable' }],
        keywordMode: 'any',
        artifactEligible: true,
        doesNotStack: false,
      };
      const { effectiveQuery, traits: found } = search(overrides);

      expect(found.length).toBeGreaterThan(0);
      expect(typed(effectiveQuery)).toEqual(found.map(({ id }) => id));
    });
  });
});
