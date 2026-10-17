import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  initialExploreState,
  KEYWORD_FILTER_FIELDS,
  KEYWORD_MODES,
  SORT_KEYS,
  type ExploreState,
} from '../explore/explore-state';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import type { KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { createMemoryTraitRepository } from '../repository/memory-trait-repository';
import { DatasetLoadError, type TraitRepository } from '../repository/trait-repository';
import type { TaxonomyEntry } from '../taxonomy/entry';
import { createTaxonomy } from '../taxonomy/registry';
import { createSearchService } from './search-service';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: null,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const mention = (key: string, kind: KeywordKind, role?: KeywordRole): KeywordHit => ({
  key,
  kind,
  ...(role === undefined ? {} : { role }),
  span: [0, 1],
});

const entry = (kind: TaxonomyEntry['kind'], key: string, extra: object = {}): TaxonomyEntry =>
  ({ kind, key, label: key.charAt(0).toUpperCase() + key.slice(1), patterns: [key], ...extra }) as TaxonomyEntry;

const taxonomy = createTaxonomy([
  entry('debuff', 'vulnerable', { canBeRandomlyApplied: true }),
  entry('debuff', 'weak', { canBeRandomlyApplied: true }),
  entry('trigger', 'start of battle', { phase: 'startOfBattle' }),
]);

// In the order of a dataset: by family, then name. Two classes have a name that is part of another's: Boss and Nether Boss.
const traits = [
  trait('a-frail', {
    class: 'Life',
    description: 'While an enemy has Weak, this creature deals more damage.',
    material: 'Frail Bone',
    keywords: [mention('weak', 'debuff', 'uses')],
  }),
  trait('b-bite', {
    class: 'Death',
    description: 'Afflicts an enemy with Weak.',
    keywords: [mention('weak', 'debuff', 'applies')],
  }),
  trait('c-bite-no-stack', {
    class: 'Death',
    description: 'Afflicts an enemy with Weak. This trait does not stack.',
    stacks: false,
    material: 'Brute Stitches',
    keywords: [mention('weak', 'debuff', 'applies')],
  }),
  trait('d-boss', {
    class: 'Boss',
    description: 'Afflicts an enemy with Vulnerable.',
    keywords: [mention('vulnerable', 'debuff', 'applies')],
  }),
  trait('e-nether', {
    class: 'Nether Boss',
    description: 'Afflicts an enemy with Weak.',
    keywords: [mention('weak', 'debuff', 'applies')],
  }),
  trait('f-opening', {
    class: 'Nature',
    description: 'At the start of battle, heals.',
    keywords: [mention('start of battle', 'trigger')],
  }),
  trait('g-heal', { class: 'Life' }),
];
const ids = (found: readonly Trait[]): string[] => found.map(({ id }) => id);

const service = () =>
  createSearchService(
    createMemoryTraitRepository({ schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits }),
    taxonomy,
  );
const stateWith = (overrides: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...overrides });
const search = async (overrides: Partial<ExploreState>) => (await service()).search(stateWith(overrides));
const found = async (overrides: Partial<ExploreState>) => ids((await search(overrides)).traits);

describe('createSearchService', () => {
  it('knows the version and the size of the dataset it loaded', async () => {
    const loaded = await service();

    expect(loaded.datasetVersion).toBe('2.0');
    expect(loaded.traitCount).toBe(7);
  });

  it('gives the trait an id stands for, and nothing for an id the dataset does not know', async () => {
    const loaded = await service();

    expect(loaded.trait('b-bite')).toBe(traits[1]);
    expect(loaded.trait('gone--from-the-sheet')).toBeUndefined();
  });

  it('does not load again for a second search', async () => {
    let loads = 0;
    const repository: TraitRepository = {
      load: () => {
        loads += 1;
        return createMemoryTraitRepository({
          schemaVersion: DATASET_SCHEMA_VERSION,
          datasetVersion: '2.0',
          traits,
        }).load();
      },
    };

    const loaded = await createSearchService(repository, taxonomy);
    loaded.search(stateWith({ query: 'weak' }));
    loaded.search(stateWith({ query: 'heal' }));

    expect(loads).toBe(1);
  });

  it('fails the way the repository failed when the dataset cannot be loaded', async () => {
    const failure = new DatasetLoadError('offline');
    const repository: TraitRepository = { load: () => Promise.reject(failure) };

    await expect(createSearchService(repository, taxonomy)).rejects.toBe(failure);
  });

  describe('the query bar', () => {
    it('finds every trait, in the order of the dataset, for the initial state', async () => {
      expect(await found({})).toEqual(ids(traits));
    });

    it('finds the traits the query asks for', async () => {
      expect(await found({ query: 'weak -stack:no' })).toEqual(['a-frail', 'b-bite', 'e-nether']);
    });

    it('reads the query once and reports what it had to repair', async () => {
      const { query, traits: result } = await search({ query: 'class:life (' });

      expect(query.diagnostics).toHaveLength(1);
      expect(ids(result)).toEqual(['a-frail', 'g-heal']);
    });

    it('marks, in a description, the text the query looks for', async () => {
      const { highlight } = await search({ query: 'weak' });

      expect(highlight('Applies Weak to an enemy.')).toEqual([[8, 12]]);
    });

    it('marks nothing for a query with no term, or for what only the filters look for', async () => {
      const { highlight } = await search({ classes: ['life'], keywords: [{ field: 'applies', key: 'weak' }] });

      expect(highlight('Applies Weak to an enemy.')).toEqual([]);
    });
  });

  describe('the class filter', () => {
    it('finds the traits of any of the classes chosen', async () => {
      expect(await found({ classes: ['life', 'nature'] })).toEqual(['a-frail', 'f-opening', 'g-heal']);
    });

    it('finds the traits of the class whatever the letter case of the name', async () => {
      expect(await found({ classes: ['LIFE'] })).toEqual(['a-frail', 'g-heal']);
    });

    it('finds no trait of Nether Boss when Boss is chosen, and the other way round', async () => {
      expect(await found({ classes: ['boss'] })).toEqual(['d-boss']);
      expect(await found({ classes: ['nether boss'] })).toEqual(['e-nether']);
      expect(await found({ classes: ['boss', 'nether boss'] })).toEqual(['d-boss', 'e-nether']);
    });

    it('finds no trait for a class that only part of a class name spells', async () => {
      expect(await found({ classes: ['lif'] })).toEqual([]);
      expect(await found({ classes: ['nowhere'] })).toEqual([]);
    });

    it('narrows the query, it does not replace it', async () => {
      expect(await found({ query: 'weak', classes: ['life', 'death'] })).toEqual([
        'a-frail',
        'b-bite',
        'c-bite-no-stack',
      ]);
    });
  });

  describe('the keyword filters', () => {
    const appliesWeak = { field: 'applies', key: 'weak' } as const;
    const usesWeak = { field: 'uses', key: 'weak' } as const;
    const appliesVulnerable = { field: 'applies', key: 'vulnerable' } as const;

    it('tells what a trait applies from what it relies on', async () => {
      expect(await found({ keywords: [appliesWeak] })).toEqual(['b-bite', 'c-bite-no-stack', 'e-nether']);
      expect(await found({ keywords: [usesWeak] })).toEqual(['a-frail']);
    });

    it('finds a keyword of any role, and a trigger, with kw', async () => {
      expect(await found({ keywords: [{ field: 'kw', key: 'weak' }] })).toEqual([
        'a-frail',
        'b-bite',
        'c-bite-no-stack',
        'e-nether',
      ]);
      expect(await found({ keywords: [{ field: 'kw', key: 'start of battle' }] })).toEqual(['f-opening']);
    });

    it('needs all of the keywords when the mode is all', async () => {
      expect(await found({ keywords: [appliesWeak, appliesVulnerable], keywordMode: 'all' })).toEqual([]);
      expect(await found({ keywords: [appliesWeak, { field: 'kw', key: 'weak' }], keywordMode: 'all' })).toEqual([
        'b-bite',
        'c-bite-no-stack',
        'e-nether',
      ]);
    });

    it('needs any of the keywords when the mode is any', async () => {
      expect(await found({ keywords: [usesWeak, appliesVulnerable], keywordMode: 'any' })).toEqual([
        'a-frail',
        'd-boss',
      ]);
    });

    it('finds nothing for a keyword nobody has', async () => {
      expect(await found({ keywords: [{ field: 'applies', key: 'mystery' }] })).toEqual([]);
    });
  });

  describe('the flags', () => {
    it('keeps the traits with a material for artifact-eligible', async () => {
      expect(await found({ artifactEligible: true })).toEqual(['a-frail', 'c-bite-no-stack']);
    });

    it('keeps the traits that do not stack for does-not-stack', async () => {
      expect(await found({ doesNotStack: true })).toEqual(['c-bite-no-stack']);
    });

    it('keeps the traits that both flags allow', async () => {
      expect(await found({ artifactEligible: true, doesNotStack: true, classes: ['life'] })).toEqual([]);
    });
  });

  describe('the sort', () => {
    it('sorts what the filters found', async () => {
      expect(await found({ classes: ['life', 'death'], sort: 'class' })).toEqual([
        'b-bite',
        'c-bite-no-stack',
        'a-frail',
        'g-heal',
      ]);
      expect(await found({ classes: ['life', 'death'], sort: 'az' })).toEqual([
        'a-frail',
        'b-bite',
        'c-bite-no-stack',
        'g-heal',
      ]);
    });
  });

  describe('the facets', () => {
    it('lists the classes of the dataset from A to Z and the keywords of the taxonomy', async () => {
      const { facets } = await search({});

      expect(facets.classes.map(({ name }) => name)).toEqual(['Boss', 'Death', 'Life', 'Nature', 'Nether Boss']);
      expect(facets.keywords.map(({ key }) => key)).toEqual(['vulnerable', 'weak', 'start of battle']);
    });

    it('counts the classes of the traits the other filters find, whatever class is chosen', async () => {
      const everything = (await search({})).facets.classes;
      const lifeOnly = (await search({ classes: ['life'] })).facets.classes;

      expect(everything.map(({ count }) => count)).toEqual([1, 2, 2, 1, 1]);
      expect(lifeOnly).toEqual(everything);
    });

    it('counts the classes of the traits the query, the keywords and the flags find', async () => {
      const counts = (overrides: Partial<ExploreState>) =>
        search(overrides).then(({ facets }) => facets.classes.map(({ count }) => count));

      expect(await counts({ query: 'weak' })).toEqual([0, 2, 1, 0, 1]);
      expect(await counts({ keywords: [{ field: 'applies', key: 'weak' }] })).toEqual([0, 2, 0, 0, 1]);
      expect(await counts({ doesNotStack: true })).toEqual([0, 1, 0, 0, 0]);
      expect(await counts({ classes: ['death'], artifactEligible: true })).toEqual([0, 1, 1, 0, 0]);
    });

    it('counts the keywords among the traits found, class filter included', async () => {
      const weak = async (overrides: Partial<ExploreState>) =>
        (await search(overrides)).facets.keywords.find(({ key }) => key === 'weak');

      expect(await weak({})).toMatchObject({ applies: 3, uses: 1, mentions: 4 });
      expect(await weak({ classes: ['death'] })).toMatchObject({ applies: 2, uses: 0, mentions: 2 });
      expect(await weak({ query: 'frail' })).toMatchObject({ applies: 0, uses: 1, mentions: 1 });
    });

    it('counts the keywords of what the keyword filters found, in either mode', async () => {
      const vulnerableCount = async (overrides: Partial<ExploreState>) =>
        (await search(overrides)).facets.keywords.find(({ key }) => key === 'vulnerable')?.applies;
      const filters = [
        { field: 'applies', key: 'weak' },
        { field: 'applies', key: 'vulnerable' },
      ] as const;

      expect(await vulnerableCount({ keywords: filters, keywordMode: 'all' })).toBe(0);
      expect(await vulnerableCount({ keywords: filters, keywordMode: 'any' })).toBe(1);
    });
  });

  describe('the effective query', () => {
    it('is no text for the initial state', async () => {
      expect((await search({})).effectiveQuery).toBe('');
    });

    it('is what the state stands for, as the query language writes it', async () => {
      const { effectiveQuery } = await search({
        query: 'weak OR heal',
        classes: ['boss', 'life'],
        keywords: [
          { field: 'applies', key: 'weak' },
          { field: 'kw', key: 'start of battle' },
        ],
        keywordMode: 'any',
        artifactEligible: true,
        doesNotStack: true,
      });

      expect(effectiveQuery).toBe(
        '(class:boss OR class:life) -class:"nether boss" (applies:weak OR kw:"start of battle") mat:yes stack:no (weak OR heal)',
      );
    });

    it('shows the query as it was repaired', async () => {
      expect((await search({ query: 'class:life (', artifactEligible: true })).effectiveQuery).toBe(
        'mat:yes class:life',
      );
    });

    describe('typed in the query bar, finds what the state finds', () => {
      const pools = {
        queries: ['', 'weak', 'weak OR heal', '-stack:no', 'class:life (', '(vulnerable OR weak) -stack:no', '"and"'],
        classes: ['life', 'death', 'boss', 'nether boss', 'nature', 'nowhere', 'lif'],
        keywords: [
          'applies:weak',
          'uses:weak',
          'kw:weak',
          'applies:vulnerable',
          'kw:start of battle',
          'applies:mystery',
        ],
      };
      const state = fc.record({
        query: fc.constantFrom(...pools.queries),
        classes: fc.uniqueArray(fc.constantFrom(...pools.classes), { maxLength: 4 }),
        keywords: fc.uniqueArray(fc.constantFrom(...pools.keywords), { maxLength: 3 }).map((items) =>
          items.map((item) => {
            const [field = '', key = ''] = item.split(':');
            return { field: field as 'applies' | 'uses' | 'kw', key };
          }),
        ),
        keywordMode: fc.constantFrom(...KEYWORD_MODES),
        artifactEligible: fc.boolean(),
        doesNotStack: fc.boolean(),
        sort: fc.constantFrom(...SORT_KEYS),
      });

      it('for any state', async () => {
        const loaded = await service();

        fc.assert(
          fc.property(state, (given) => {
            const outcome = loaded.search(given);
            const typed = loaded.search(stateWith({ query: outcome.effectiveQuery }));

            expect(typed.query.diagnostics, outcome.effectiveQuery).toEqual([]);
            expect(new Set(ids(typed.traits)), outcome.effectiveQuery).toEqual(new Set(ids(outcome.traits)));
          }),
        );
      });
    });
  });
});

describe('searching any state', () => {
  // An address can say anything: quotes, parentheses and operators in the query bar, in a class and in a keyword.
  const text = fc.string({
    unit: fc.constantFrom('a', 'L', '"', '(', ')', '-', ':', ' ', '&', '|', '%', '😀'),
    maxLength: 10,
  });
  const state = fc.record({
    query: text,
    classes: fc.array(text, { maxLength: 3 }),
    keywords: fc.array(fc.record({ field: fc.constantFrom(...KEYWORD_FILTER_FIELDS), key: text }), { maxLength: 3 }),
    keywordMode: fc.constantFrom(...KEYWORD_MODES),
    artifactEligible: fc.boolean(),
    doesNotStack: fc.boolean(),
    sort: fc.constantFrom(...SORT_KEYS),
  });

  it('finds traits of the dataset and lists every facet, whatever the state says', async () => {
    const loaded = await service();

    fc.assert(
      fc.property(state, (given) => {
        const outcome = loaded.search(given);

        expect(outcome.traits.every((found) => traits.includes(found))).toBe(true);
        expect(outcome.facets.classes).toHaveLength(5);
        expect(outcome.facets.keywords).toHaveLength(3);
        expect(typeof outcome.effectiveQuery).toBe('string');
      }),
    );
  });
});
