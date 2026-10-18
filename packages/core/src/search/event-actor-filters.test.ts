import { describe, expect, it } from 'vitest';
import { setEventActors, toggleActor } from '../explore/event-actors';
import { initialExploreState, type ExploreState, type KeywordFilter } from '../explore/explore-state';
import { toggleKeywordSide } from '../explore/facet-toggles';
import { facetCount, type KeywordFacet } from '../explore/facets';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import type { KeywordActor, KeywordRole, Trait } from '../model/trait';
import { createMemoryTraitRepository } from '../repository/memory-trait-repository';
import type { TaxonomyEntry } from '../taxonomy/entry';
import { createTaxonomy } from '../taxonomy/registry';
import { createSearchService } from './search-service';

// Several actors on one side of an event (SPEC §8.1): the filters are alternatives, whichever the match mode, and the count
// beside the button is the number of traits they find together.

const trait = (id: string, role: KeywordRole, ...actors: (KeywordActor | undefined)[]): Trait => ({
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
  keywords: actors.map((actor) => ({
    key: 'attack',
    kind: 'event',
    role,
    ...(actor === undefined ? {} : { actor }),
    span: [0, 1],
  })),
  conditionalSources: [],
});

const taxonomy = createTaxonomy([
  { kind: 'event', key: 'attack', label: 'Attack', patterns: ['attack'], group: 'actions', phase: 'attacking' },
  { kind: 'debuff', key: 'weak', label: 'Weak', patterns: ['weak'], canBeRandomlyApplied: true },
] as TaxonomyEntry[]);

const traits: Trait[] = [
  trait('a-self', 'uses', 'self'),
  trait('b-enemy', 'uses', 'enemy'),
  trait('c-ally', 'uses', 'ally'),
  trait('d-self-and-enemy', 'uses', 'self', 'enemy'),
  trait('e-nobody', 'uses', undefined),
  trait('f-causes', 'applies', 'self'),
  { ...trait('g-weak', 'applies'), keywords: [{ key: 'weak', kind: 'debuff', role: 'applies', span: [0, 1] }] },
];

const loaded = await createSearchService(
  createMemoryTraitRepository({ schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits }),
  taxonomy,
);
const found = (state: Partial<ExploreState>): string[] =>
  loaded.search({ ...initialExploreState, ...state }).traits.map(({ id }) => id);
const reacting = (actor: KeywordActor): KeywordFilter => ({ field: 'uses', key: 'attack', actor });
const attackFacet = (state: Partial<ExploreState>): KeywordFacet => {
  const facet = loaded.search({ ...initialExploreState, ...state }).facets.keywords.find(({ key }) => key === 'attack');
  if (facet === undefined) throw new Error('no facet for attack');
  return facet;
};

describe('an event filtered by several actors', () => {
  it('finds the traits that name either, with every keyword needed', () => {
    expect(found({ keywords: [reacting('self'), reacting('enemy')], keywordMode: 'all' })).toEqual([
      'a-self',
      'b-enemy',
      'd-self-and-enemy',
    ]);
  });

  it('finds the same with any of the keywords enough', () => {
    expect(found({ keywords: [reacting('self'), reacting('enemy')], keywordMode: 'any' })).toEqual([
      'a-self',
      'b-enemy',
      'd-self-and-enemy',
    ]);
  });

  it('needs the other keywords all the same, in the mode all', () => {
    const weak: KeywordFilter = { field: 'applies', key: 'weak' };

    expect(found({ keywords: [reacting('self'), reacting('enemy'), weak], keywordMode: 'all' })).toEqual([]);
    expect(found({ keywords: [reacting('self'), reacting('enemy'), weak], keywordMode: 'any' })).toEqual([
      'a-self',
      'b-enemy',
      'd-self-and-enemy',
      'g-weak',
    ]);
  });

  it('keeps the other side of the event apart: it is another filter, and needed as well', () => {
    const causing: KeywordFilter = { field: 'applies', key: 'attack', actor: 'self' };

    expect(found({ keywords: [reacting('self'), reacting('enemy'), causing], keywordMode: 'all' })).toEqual([]);
    expect(found({ keywords: [reacting('self'), reacting('enemy'), causing], keywordMode: 'any' })).toEqual([
      'a-self',
      'b-enemy',
      'd-self-and-enemy',
      'f-causes',
    ]);
  });

  it('is the filter the effective query writes, which finds the same typed in the query bar', () => {
    const state = { keywords: [reacting('self'), reacting('enemy')], keywordMode: 'all' } as const;
    const { effectiveQuery } = loaded.search({ ...initialExploreState, ...state });

    expect(effectiveQuery).toBe('(uses:attack/self OR uses:attack/enemy)');
    expect(found({ query: effectiveQuery })).toEqual(found(state));
  });

  it('is counted beside the buttons as the traits it finds together, each once', () => {
    const facet = attackFacet({});

    expect(facetCount(facet, 'uses', ['self'])).toBe(2);
    expect(facetCount(facet, 'uses', ['enemy'])).toBe(2);
    expect(facetCount(facet, 'uses', ['self', 'enemy'])).toBe(3);
    expect(facetCount(facet, 'uses', ['self', 'enemy'])).toBe(
      found({ keywords: [reacting('self'), reacting('enemy')], keywordMode: 'all' }).length,
    );
  });

  it('is what the panel makes of a press on the control and then on a button', () => {
    const keywords = loaded.search(initialExploreState).facets.keywords;
    const side = { field: 'uses', key: 'attack' } as const;
    const withSelf = toggleKeywordSide(initialExploreState, side, ['self']);

    const withBoth = setEventActors(withSelf, keywords, toggleActor(['self'], 'enemy'));

    expect(withBoth.keywords).toEqual([reacting('self'), reacting('enemy')]);
    expect(found(withBoth)).toEqual(['a-self', 'b-enemy', 'd-self-and-enemy']);
  });
});
