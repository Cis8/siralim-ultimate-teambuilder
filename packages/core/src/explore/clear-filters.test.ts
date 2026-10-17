import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clearFilters } from './clear-filters';
import { initialExploreState, type ExploreState } from './explore-state';
import { filterChips } from './filter-chips';

const stateWith = (patch: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...patch });

describe('clearFilters', () => {
  it('takes off every class, keyword and flag', () => {
    const state = stateWith({
      classes: ['nature', 'life'],
      keywords: [
        { field: 'applies', key: 'vulnerable' },
        { field: 'kw', key: 'start of battle' },
      ],
      artifactEligible: true,
      doesNotStack: true,
    });

    expect(clearFilters(state)).toEqual(initialExploreState);
  });

  it('keeps what is a setting of the search and not a filter: the query bar, the sort and the match mode', () => {
    const state = stateWith({
      query: 'weak OR snared',
      sort: 'az',
      keywordMode: 'any',
      classes: ['life'],
      keywords: [{ field: 'uses', key: 'weak' }],
      doesNotStack: true,
    });

    expect(clearFilters(state)).toEqual(stateWith({ query: 'weak OR snared', sort: 'az', keywordMode: 'any' }));
  });

  it('takes off a single flag as well as a single class', () => {
    expect(clearFilters(stateWith({ artifactEligible: true }))).toEqual(initialExploreState);
    expect(clearFilters(stateWith({ classes: ['boss'] }))).toEqual(initialExploreState);
  });

  it('gives back the very state it was given when no filter is on, so that nothing is written for it', () => {
    const state = stateWith({ query: 'weak', sort: 'class', keywordMode: 'any' });

    expect(clearFilters(state)).toBe(state);
    expect(clearFilters(initialExploreState)).toBe(initialExploreState);
  });

  it('does not change the state it was given', () => {
    const given = stateWith({ classes: ['life'], doesNotStack: true });

    clearFilters(given);

    expect(given).toEqual(stateWith({ classes: ['life'], doesNotStack: true }));
  });

  it('leaves no chip, whatever the state', () => {
    const state = fc.record({
      query: fc.string(),
      classes: fc.uniqueArray(fc.constantFrom('life', 'death', 'nether boss')),
      keywords: fc.uniqueArray(
        fc.record({
          field: fc.constantFrom('applies', 'uses', 'kw'),
          key: fc.constantFrom('vulnerable', 'weak', 'start of battle'),
        }),
        { selector: ({ field, key }) => `${field}:${key}` },
      ),
      keywordMode: fc.constantFrom('all', 'any'),
      artifactEligible: fc.boolean(),
      doesNotStack: fc.boolean(),
      sort: fc.constantFrom('book', 'class', 'az'),
    }) satisfies fc.Arbitrary<ExploreState>;

    fc.assert(
      fc.property(state, (before) => {
        const after = clearFilters(before);
        expect(filterChips(after)).toEqual([]);
        expect({ query: after.query, keywordMode: after.keywordMode, sort: after.sort }).toEqual({
          query: before.query,
          keywordMode: before.keywordMode,
          sort: before.sort,
        });
      }),
    );
  });
});
