import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { createTraitIndex } from '../query/trait-index';
import type { TaxonomyEntry } from '../taxonomy/entry';
import { createTaxonomy } from '../taxonomy/registry';
import { countFacets, facetVocabulary } from './facets';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: '',
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
  ({ kind, key, label: key.toUpperCase(), patterns: [key], ...extra }) as TaxonomyEntry;

// Not in the order of the facets, to see them put in order.
const taxonomy = createTaxonomy([
  entry('mechanic', 'timeline'),
  entry('buff', 'shelled'),
  entry('debuff', 'weak', { canBeRandomlyApplied: true }),
  entry('flag', 'nostack'),
  entry('trigger', 'start of battle', { phase: 'startOfBattle' }),
  entry('debuff', 'vulnerable', { canBeRandomlyApplied: true }),
  entry('effect', 'zombies'),
]);

describe('facetVocabulary', () => {
  it('lists the classes of the dataset once each, as it spells them, from A to Z', () => {
    const index = createTraitIndex([
      trait('a', { class: 'Sorcery' }),
      trait('b', { class: 'Death' }),
      trait('c', { class: 'Nether Boss' }),
      trait('d', { class: 'Death' }),
      trait('e', { class: 'Boss' }),
    ]);

    expect(facetVocabulary(index, taxonomy).classNames).toEqual(['Boss', 'Death', 'Nether Boss', 'Sorcery']);
  });

  it('counts classes that differ only in letter case as one, spelled as first met', () => {
    const index = createTraitIndex([trait('a', { class: 'Life' }), trait('b', { class: 'life' })]);

    expect(facetVocabulary(index, taxonomy).classNames).toEqual(['Life']);
  });

  it('lists the keywords of the taxonomy by kind, then in the order of the taxonomy, without the flags', () => {
    const { keywords } = facetVocabulary(createTraitIndex([]), taxonomy);

    expect(keywords.map(({ kind, key }) => `${kind}:${key}`)).toEqual([
      'debuff:weak',
      'debuff:vulnerable',
      'buff:shelled',
      'effect:zombies',
      'trigger:start of battle',
      'mechanic:timeline',
    ]);
  });

  it('lists no class for an empty dataset', () => {
    expect(facetVocabulary(createTraitIndex([]), taxonomy).classNames).toEqual([]);
  });
});

describe('countFacets', () => {
  const traits = [
    trait('gives-weak', { class: 'Death', keywords: [mention('weak', 'debuff', 'applies')] }),
    trait('gives-weak-twice', {
      class: 'Life',
      keywords: [mention('weak', 'debuff', 'applies'), mention('weak', 'debuff', 'applies')],
    }),
    trait('relies-on-weak', { class: 'Life', keywords: [mention('weak', 'debuff', 'uses')] }),
    trait('does-both', {
      class: 'Death',
      keywords: [mention('weak', 'debuff', 'applies'), mention('weak', 'debuff', 'uses')],
    }),
    trait('guards-against-weak', { class: 'Nature', keywords: [mention('weak', 'debuff', 'resists')] }),
    trait('at-the-start', {
      class: 'Nature',
      keywords: [mention('start of battle', 'trigger'), mention('timeline', 'mechanic')],
    }),
    trait('plain', { class: 'Nature' }),
  ];
  const index = createTraitIndex(traits);
  const vocabulary = facetVocabulary(index, taxonomy);
  const facetsFor = (found: readonly string[], withoutClassFilter: readonly string[] = found) =>
    countFacets(
      vocabulary,
      index.entries.filter(({ trait: each }) => withoutClassFilter.includes(each.id)),
      index.entries.filter(({ trait: each }) => found.includes(each.id)),
    );
  const everyone = traits.map(({ id }) => id);
  const keywordFacet = (found: readonly string[], key: string) =>
    facetsFor(found).keywords.find((facet) => facet.key === key);

  describe('classes', () => {
    it('counts the traits of each class among those the class filter leaves out of account', () => {
      const facets = facetsFor(['gives-weak'], everyone);

      expect(facets.classes).toEqual([
        { name: 'Death', count: 2 },
        { name: 'Life', count: 2 },
        { name: 'Nature', count: 3 },
      ]);
    });

    it('lists a class with no trait there with a count of 0', () => {
      expect(facetsFor(['gives-weak'], ['gives-weak']).classes).toEqual([
        { name: 'Death', count: 1 },
        { name: 'Life', count: 0 },
        { name: 'Nature', count: 0 },
      ]);
    });

    it('counts without regard to the traits that the filter on classes would keep', () => {
      const facets = facetsFor([], ['does-both', 'plain']);

      expect(facets.classes.map(({ count }) => count)).toEqual([1, 0, 1]);
    });
  });

  describe('keywords', () => {
    it('counts the traits that apply, rely on, and mention each, among the traits found', () => {
      expect(keywordFacet(everyone, 'weak')).toEqual({
        key: 'weak',
        label: 'WEAK',
        kind: 'debuff',
        applies: 3,
        uses: 2,
        mentions: 5,
      });
    });

    it('counts a trait once per keyword, however many times it mentions it', () => {
      expect(keywordFacet(['gives-weak-twice'], 'weak')).toMatchObject({ applies: 1, uses: 0, mentions: 1 });
    });

    it('counts a trait that applies and relies on a keyword in both', () => {
      expect(keywordFacet(['does-both'], 'weak')).toMatchObject({ applies: 1, uses: 1, mentions: 1 });
    });

    it('counts a mention that only guards against a keyword as a mention, not a role', () => {
      expect(keywordFacet(['guards-against-weak'], 'weak')).toMatchObject({ applies: 0, uses: 0, mentions: 1 });
    });

    it('counts a trigger or a mechanic as a mention, with no role', () => {
      expect(keywordFacet(everyone, 'start of battle')).toMatchObject({ applies: 0, uses: 0, mentions: 1 });
      expect(keywordFacet(everyone, 'timeline')).toMatchObject({ applies: 0, uses: 0, mentions: 1 });
    });

    it('counts only the traits found', () => {
      expect(keywordFacet(['relies-on-weak', 'plain'], 'weak')).toMatchObject({ applies: 0, uses: 1, mentions: 1 });
    });

    it('lists every keyword of the taxonomy, with 0 for one nobody mentions', () => {
      const { keywords } = facetsFor([]);

      expect(keywords).toHaveLength(6);
      expect(keywords.every(({ applies, uses, mentions }) => applies + uses + mentions === 0)).toBe(true);
    });

    it('lists the keywords in the order of the vocabulary', () => {
      expect(facetsFor(everyone).keywords.map(({ key }) => key)).toEqual(vocabulary.keywords.map(({ key }) => key));
    });

    it('leaves out a keyword that the taxonomy does not know', () => {
      const unknown = createTraitIndex([trait('x', { keywords: [mention('mystery', 'debuff', 'applies')] })]);
      const { keywords } = countFacets(vocabulary, unknown.entries, unknown.entries);

      expect(keywords.map(({ key }) => key)).not.toContain('mystery');
    });
  });
});
