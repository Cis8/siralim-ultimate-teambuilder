import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { activeFilterCounts, FILTER_SECTIONS } from './active-filter-counts';
import { initialExploreState, type ExploreState } from './explore-state';
import { filterChips } from './filter-chips';
import type { KeywordFacet } from './facets';

const stateWith = (patch: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...patch });

const vocabulary: readonly Pick<KeywordFacet, 'key' | 'kind'>[] = [
  { key: 'vulnerable', kind: 'debuff' },
  { key: 'weak', kind: 'debuff' },
  { key: 'barrier', kind: 'buff' },
  { key: 'dire wolves', kind: 'effect' },
  { key: 'start of battle', kind: 'event' },
  { key: 'charges', kind: 'mechanic' },
];

const none = { class: 0, debuff: 0, buff: 0, effect: 0, event: 0, mechanic: 0, flags: 0 };

describe('activeFilterCounts', () => {
  it('is zero in every section for a state with no filter, whatever the query bar and the settings say', () => {
    expect(activeFilterCounts(initialExploreState, vocabulary)).toEqual(none);
    expect(activeFilterCounts(stateWith({ query: 'weak', sort: 'az', keywordMode: 'any' }), vocabulary)).toEqual(none);
  });

  it('counts the classes in their section', () => {
    expect(activeFilterCounts(stateWith({ classes: ['life', 'nether boss'] }), vocabulary)).toEqual({
      ...none,
      class: 2,
    });
  });

  it('counts each keyword filter in the section of its kind', () => {
    const state = stateWith({
      keywords: [
        { field: 'applies', key: 'vulnerable' },
        { field: 'uses', key: 'weak' },
        { field: 'applies', key: 'barrier' },
        { field: 'uses', key: 'dire wolves' },
        { field: 'kw', key: 'start of battle' },
        { field: 'kw', key: 'charges' },
      ],
    });

    expect(activeFilterCounts(state, vocabulary)).toEqual({
      ...none,
      debuff: 2,
      buff: 1,
      effect: 1,
      event: 1,
      mechanic: 1,
    });
  });

  it('counts the two sides of one keyword as two filters, as the chip row and "Clear filters" do', () => {
    const state = stateWith({
      keywords: [
        { field: 'applies', key: 'weak' },
        { field: 'uses', key: 'weak' },
      ],
    });

    expect(activeFilterCounts(state, vocabulary).debuff).toBe(2);
  });

  it('counts an event by an actor in the section of the event, and by each actor as a filter of its own', () => {
    const state = stateWith({
      keywords: [
        { field: 'uses', key: 'start of battle' },
        { field: 'uses', key: 'start of battle', actor: 'self' },
        { field: 'uses', key: 'start of battle', actor: 'enemy' },
      ],
    });

    expect(activeFilterCounts(state, vocabulary)).toEqual({ ...none, event: 3 });
  });

  it('counts each flag that is on in the flags section', () => {
    expect(activeFilterCounts(stateWith({ artifactEligible: true }), vocabulary)).toEqual({ ...none, flags: 1 });
    expect(activeFilterCounts(stateWith({ artifactEligible: true, doesNotStack: true }), vocabulary)).toEqual({
      ...none,
      flags: 2,
    });
  });

  it('leaves out a keyword the panel does not list, since no section holds it', () => {
    const state = stateWith({ keywords: [{ field: 'kw', key: 'not in the taxonomy' }] });

    expect(activeFilterCounts(state, vocabulary)).toEqual(none);
  });

  it('has a count for every section, in the order the panel shows them', () => {
    expect(FILTER_SECTIONS).toEqual(['class', 'debuff', 'buff', 'effect', 'event', 'mechanic', 'flags']);
    expect(Object.keys(activeFilterCounts(initialExploreState, vocabulary))).toEqual([...FILTER_SECTIONS]);
  });

  it('adds up to the filters that are on, when the panel lists every keyword', () => {
    const state = fc.record({
      query: fc.string(),
      classes: fc.uniqueArray(fc.constantFrom('life', 'death', 'nether boss')),
      keywords: fc.uniqueArray(
        fc.record({
          field: fc.constantFrom('applies', 'uses', 'kw'),
          key: fc.constantFrom(...vocabulary.map(({ key }) => key)),
        }),
        { selector: ({ field, key }) => `${field}:${key}` },
      ),
      keywordMode: fc.constantFrom('all', 'any'),
      artifactEligible: fc.boolean(),
      doesNotStack: fc.boolean(),
      sort: fc.constantFrom('book', 'class', 'az'),
    }) satisfies fc.Arbitrary<ExploreState>;

    fc.assert(
      fc.property(state, (given) => {
        const total = Object.values(activeFilterCounts(given, vocabulary)).reduce((sum, count) => sum + count, 0);
        expect(total).toBe(filterChips(given).length);
      }),
    );
  });
});
