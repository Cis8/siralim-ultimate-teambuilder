import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS } from '../model/trait';
import { initialExploreState, type ExploreState, type KeywordFilter } from './explore-state';
import {
  hasClass,
  hasKeywordFilter,
  hasKeywordSide,
  toggleClass,
  toggleKeywordFilter,
  toggleKeywordSide,
} from './facet-toggles';

const stateWith = (patch: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...patch });

const applies = (key: string): KeywordFilter => ({ field: 'applies', key });
const uses = (key: string): KeywordFilter => ({ field: 'uses', key });
const idOf = ({ field, key, actor }: KeywordFilter): string => `${field}:${key}/${actor ?? ''}`;
const byFilter = (a: KeywordFilter, b: KeywordFilter): number => idOf(a).localeCompare(idOf(b));

describe('toggleClass', () => {
  it('chooses a class, and takes it off with a second toggle', () => {
    const chosen = toggleClass(initialExploreState, 'Life');

    expect(chosen.classes).toEqual(['life']);
    expect(toggleClass(chosen, 'Life')).toEqual(initialExploreState);
  });

  it('writes the name as the state keeps it, in lower case, and finds it however it is spelled', () => {
    const state = stateWith({ classes: ['nether boss'] });

    expect(hasClass(state, 'Nether Boss')).toBe(true);
    expect(hasClass(state, 'nether boss')).toBe(true);
    expect(toggleClass(state, 'NETHER BOSS').classes).toEqual([]);
  });

  it('keeps the order in which the classes were chosen', () => {
    const state = ['Nature', 'Death', 'Life'].reduce(toggleClass, initialExploreState);

    expect(state.classes).toEqual(['nature', 'death', 'life']);
    expect(toggleClass(state, 'Death').classes).toEqual(['nature', 'life']);
  });

  it('tells a class from another', () => {
    const state = stateWith({ classes: ['boss'] });

    expect(hasClass(state, 'Nether Boss')).toBe(false);
    expect(hasClass(state, 'Boss')).toBe(true);
  });
});

describe('toggleKeywordFilter', () => {
  it('adds a filter after the others, and takes it off with a second toggle', () => {
    const state = stateWith({ keywords: [applies('weak')] });

    const added = toggleKeywordFilter(state, uses('vulnerable'));

    expect(added.keywords).toEqual([applies('weak'), uses('vulnerable')]);
    expect(toggleKeywordFilter(added, uses('vulnerable'))).toEqual(state);
  });

  it('keeps the two roles of a keyword apart: both can be on', () => {
    const both = toggleKeywordFilter(stateWith({ keywords: [applies('vulnerable')] }), uses('vulnerable'));

    expect(both.keywords).toEqual([applies('vulnerable'), uses('vulnerable')]);
    expect(toggleKeywordFilter(both, applies('vulnerable')).keywords).toEqual([uses('vulnerable')]);
  });

  it('tells the actors of an event apart: the event by anyone and by one actor are different filters', () => {
    const anyone = uses('attack');
    const self: KeywordFilter = { field: 'uses', key: 'attack', actor: 'self' };
    const both = toggleKeywordFilter(stateWith({ keywords: [anyone] }), self);

    expect(both.keywords).toEqual([anyone, self]);
    expect(hasKeywordFilter(both, { field: 'uses', key: 'attack', actor: 'enemy' })).toBe(false);
    expect(toggleKeywordFilter(both, self).keywords).toEqual([anyone]);
    expect(toggleKeywordFilter(both, anyone).keywords).toEqual([self]);
  });

  it('tells a keyword from another and a field from another', () => {
    const state = stateWith({ keywords: [{ field: 'kw', key: 'vulnerable' }] });

    expect(hasKeywordFilter(state, { field: 'kw', key: 'vulnerable' })).toBe(true);
    expect(hasKeywordFilter(state, applies('vulnerable'))).toBe(false);
    expect(hasKeywordFilter(state, { field: 'kw', key: 'weak' })).toBe(false);
  });
});

describe('toggleKeywordSide', () => {
  const self: KeywordFilter = { field: 'uses', key: 'attack', actor: 'self' };
  const enemy: KeywordFilter = { field: 'uses', key: 'attack', actor: 'enemy' };

  it('turns a side on after the others, by the actor it is given', () => {
    const state = stateWith({ keywords: [applies('weak')] });

    expect(toggleKeywordSide(state, uses('attack'), ['self']).keywords).toEqual([applies('weak'), self]);
    expect(toggleKeywordSide(state, uses('attack')).keywords).toEqual([applies('weak'), uses('attack')]);
    expect(toggleKeywordSide(state, uses('attack'), []).keywords).toEqual([applies('weak'), uses('attack')]);
  });

  it('turns a side on for several actors with a filter for each, in the order given', () => {
    const state = stateWith({ keywords: [applies('weak')] });

    expect(toggleKeywordSide(state, uses('attack'), ['self', 'enemy']).keywords).toEqual([
      applies('weak'),
      self,
      enemy,
    ]);
  });

  it('is on when a filter of its field and keyword is, by anyone or by one actor', () => {
    expect(hasKeywordSide(stateWith({ keywords: [self] }), uses('attack'))).toBe(true);
    expect(hasKeywordSide(stateWith({ keywords: [uses('attack')] }), uses('attack'))).toBe(true);
    expect(hasKeywordSide(stateWith({ keywords: [applies('attack')] }), uses('attack'))).toBe(false);
    expect(hasKeywordSide(stateWith({ keywords: [self] }), uses('provoke'))).toBe(false);
    expect(hasKeywordSide(initialExploreState, uses('attack'))).toBe(false);
  });

  it('turns a side off whoever acts in the filters on it, and keeps everything else', () => {
    const state = stateWith({
      keywords: [applies('attack'), self, uses('provoke'), uses('attack'), enemy, { field: 'kw', key: 'attack' }],
    });

    expect(toggleKeywordSide(state, uses('attack'), ['ally', 'enemy']).keywords).toEqual([
      applies('attack'),
      uses('provoke'),
      { field: 'kw', key: 'attack' },
    ]);
  });

  it('is undone by a second toggle', () => {
    const state = stateWith({ keywords: [applies('weak')] });
    const toggle = (from: ExploreState) => toggleKeywordSide(from, uses('attack'), ['self', 'enemy']);

    expect(toggle(toggle(state))).toEqual(state);
  });

  it('leaves the rest of the state alone', () => {
    const state = stateWith({ query: 'weak', classes: ['life'], keywordMode: 'any', sort: 'az' });

    expect(toggleKeywordSide(state, uses('attack'), ['enemy'])).toEqual({ ...state, keywords: [enemy] });
  });
});

describe('a toggle, on any state', () => {
  const filter = fc.record(
    {
      field: fc.constantFrom('applies', 'uses', 'kw'),
      key: fc.constantFrom('vulnerable', 'weak', 'start of battle', 'attack'),
      actor: fc.constantFrom(...KEYWORD_ACTORS),
    },
    { requiredKeys: ['field', 'key'] },
  ) satisfies fc.Arbitrary<KeywordFilter>;
  const state = fc.record({
    query: fc.string(),
    classes: fc.uniqueArray(fc.constantFrom('life', 'death', 'nether boss')),
    keywords: fc.uniqueArray(filter, { selector: idOf }),
    keywordMode: fc.constantFrom('all', 'any'),
    artifactEligible: fc.boolean(),
    doesNotStack: fc.boolean(),
    sort: fc.constantFrom('book', 'class', 'az'),
  }) satisfies fc.Arbitrary<ExploreState>;
  const className = fc.constantFrom('Life', 'Death', 'Nether Boss');

  it('flips whether the class is chosen, and the other classes stay as they were', () => {
    fc.assert(
      fc.property(state, className, (before, name) => {
        const after = toggleClass(before, name);
        expect(hasClass(after, name)).toBe(!hasClass(before, name));
        expect(after.classes.filter((chosen) => chosen !== name.toLowerCase())).toEqual(
          before.classes.filter((chosen) => chosen !== name.toLowerCase()),
        );
        expect({ ...after, classes: [] }).toEqual({ ...before, classes: [] });
      }),
    );
  });

  it('flips whether the filter is on, and leaves the other filters and the rest of the state alone', () => {
    fc.assert(
      fc.property(state, filter, (before, chosen) => {
        const after = toggleKeywordFilter(before, chosen);
        expect(hasKeywordFilter(after, chosen)).toBe(!hasKeywordFilter(before, chosen));
        const others = (kept: ExploreState) => kept.keywords.filter((each) => idOf(each) !== idOf(chosen));
        expect(others(after)).toEqual(others(before));
        expect({ ...after, keywords: [] }).toEqual({ ...before, keywords: [] });
      }),
    );
  });

  it('is undone by a second toggle, a filter that was on going to the end of the list', () => {
    fc.assert(
      fc.property(state, filter, className, (before, chosen, name) => {
        const keywords = toggleKeywordFilter(toggleKeywordFilter(before, chosen), chosen).keywords;
        expect(keywords.toSorted(byFilter)).toEqual(before.keywords.toSorted(byFilter));
        const classes = toggleClass(toggleClass(before, name), name).classes;
        expect(classes.toSorted()).toEqual(before.classes.toSorted());
      }),
    );
  });
});
