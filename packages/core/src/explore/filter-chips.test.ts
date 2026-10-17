import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { queryChips } from '../query/chips';
import { filterQuery } from './effective-query';
import { initialExploreState, type ExploreState } from './explore-state';
import { filterChips, removeFilterChip } from './filter-chips';

const stateWith = (patch: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...patch });

describe('filterChips', () => {
  it('has none for a state with no filter, whatever the query bar and the sort say', () => {
    expect(filterChips(initialExploreState)).toEqual([]);
    expect(filterChips(stateWith({ query: 'weak OR snared', sort: 'az', keywordMode: 'any' }))).toEqual([]);
  });

  it('has one per class, keyword and flag chosen: the classes first, then the keywords, then the flags', () => {
    const state = stateWith({
      classes: ['nature', 'life'],
      keywords: [
        { field: 'uses', key: 'weak' },
        { field: 'applies', key: 'vulnerable' },
        { field: 'kw', key: 'start of battle' },
      ],
      artifactEligible: true,
      doesNotStack: true,
    });

    expect(filterChips(state)).toEqual([
      { field: 'class', value: 'nature' },
      { field: 'class', value: 'life' },
      { field: 'uses', value: 'weak' },
      { field: 'applies', value: 'vulnerable' },
      { field: 'kw', value: 'start of battle' },
      { field: 'mat', value: 'yes' },
      { field: 'stack', value: 'no' },
    ]);
  });

  it('has the flags only for those that are on', () => {
    expect(filterChips(stateWith({ doesNotStack: true }))).toEqual([{ field: 'stack', value: 'no' }]);
    expect(filterChips(stateWith({ artifactEligible: true }))).toEqual([{ field: 'mat', value: 'yes' }]);
  });
});

describe('removeFilterChip', () => {
  const state = stateWith({
    query: 'snared',
    classes: ['nature', 'life'],
    keywords: [
      { field: 'applies', key: 'vulnerable' },
      { field: 'uses', key: 'weak' },
    ],
    keywordMode: 'any',
    artifactEligible: true,
    doesNotStack: true,
    sort: 'class',
  });

  it.each([
    [0, { classes: ['life'] }],
    [1, { classes: ['nature'] }],
    [2, { keywords: [{ field: 'uses', key: 'weak' }] }],
    [3, { keywords: [{ field: 'applies', key: 'vulnerable' }] }],
    [4, { artifactEligible: false }],
    [5, { doesNotStack: false }],
  ] satisfies [number, Partial<ExploreState>][])('takes away chip %i and nothing else', (index, patch) => {
    expect(removeFilterChip(state, index)).toEqual({ ...state, ...patch });
  });

  it('leaves the state as it is for a chip it does not have', () => {
    expect(removeFilterChip(state, 6)).toEqual(state);
    expect(removeFilterChip(state, -1)).toEqual(state);
    expect(removeFilterChip(initialExploreState, 0)).toEqual(initialExploreState);
  });

  it('does not change the state it was given', () => {
    const given = stateWith({ classes: ['life'], keywords: [{ field: 'uses', key: 'weak' }], doesNotStack: true });

    removeFilterChip(given, 1);

    expect(given).toEqual(
      stateWith({ classes: ['life'], keywords: [{ field: 'uses', key: 'weak' }], doesNotStack: true }),
    );
  });
});

describe('the chips of any state', () => {
  const classNames = ['life', 'death', 'nether boss'];
  const state = fc.record({
    query: fc.string(),
    classes: fc.uniqueArray(fc.constantFrom(...classNames)),
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

  it('leave the state with no filter once each has been removed, and the rest of it untouched', () => {
    fc.assert(
      fc.property(state, (before) => {
        let after: ExploreState = before;
        for (let left = filterChips(before).length; left > 0; left--) after = removeFilterChip(after, 0);
        expect(filterChips(after)).toEqual([]);
        expect(after).toEqual({
          ...before,
          classes: [],
          keywords: [],
          artifactEligible: false,
          doesNotStack: false,
        });
      }),
    );
  });

  it('take one filter away each, so that the others are all still there', () => {
    fc.assert(
      fc.property(state, fc.nat(), (before, pick) => {
        const chips = filterChips(before);
        fc.pre(chips.length > 0);
        const index = pick % chips.length;
        expect(filterChips(removeFilterChip(before, index))).toEqual(chips.filter((_chip, at) => at !== index));
      }),
    );
  });

  it('are the terms of the query that the filters stand for', () => {
    fc.assert(
      fc.property(state, (before) => {
        const written = filterQuery(before, classNames);
        const terms = [written.classes, written.rest]
          .flatMap(queryChips)
          // The classes the query leaves out again are written by the query only: no chip stands for them.
          .filter(({ negated }) => !negated)
          .map(({ field, value }) => ({ field, value }));
        expect(terms).toEqual(filterChips(before));
      }),
    );
  });
});
