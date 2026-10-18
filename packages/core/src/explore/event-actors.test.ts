import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS, type KeywordActor } from '../model/trait';
import { eventActors, narrowEventFilters } from './event-actors';
import { initialExploreState, type ExploreState, type KeywordFilter } from './explore-state';
import type { KeywordFacet } from './facets';

const stateWith = (keywords: readonly KeywordFilter[], patch: Partial<ExploreState> = {}): ExploreState => ({
  ...initialExploreState,
  ...patch,
  keywords,
});

const vocabulary: readonly Pick<KeywordFacet, 'key' | 'kind'>[] = [
  { key: 'attack', kind: 'event' },
  { key: 'death', kind: 'event' },
  { key: 'start of battle', kind: 'event' },
  { key: 'weak', kind: 'debuff' },
  { key: 'charges', kind: 'mechanic' },
];

const filter = (field: KeywordFilter['field'], key: string, actor?: KeywordActor): KeywordFilter =>
  actor === undefined ? { field, key } : { field, key, actor };

describe('eventActors', () => {
  it('is empty when no event is filtered on', () => {
    expect(eventActors(initialExploreState, vocabulary)).toEqual([]);
    expect(eventActors(stateWith([filter('applies', 'weak'), filter('kw', 'charges')]), vocabulary)).toEqual([]);
  });

  it('leaves out a keyword the panel does not list, as the counts of the sections do', () => {
    expect(eventActors(stateWith([filter('kw', 'unheard-of', 'self')]), vocabulary)).toEqual([]);
  });

  it('is the actor of the event filters, once, when they all name the same one', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'death', 'self'),
      filter('kw', 'weak'),
    ]);

    expect(eventActors(state, vocabulary)).toEqual(['self']);
  });

  it('is undefined for a filter that names no actor, and lists it beside the others', () => {
    expect(eventActors(stateWith([filter('uses', 'attack'), filter('uses', 'death')]), vocabulary)).toEqual([
      undefined,
    ]);
    expect(eventActors(stateWith([filter('uses', 'attack', 'self'), filter('uses', 'death')]), vocabulary)).toEqual([
      'self',
      undefined,
    ]);
  });

  it('lists the actors in the order the filters were chosen in', () => {
    const state = stateWith([
      filter('uses', 'attack', 'enemy'),
      filter('uses', 'death', 'self'),
      filter('applies', 'attack', 'enemy'),
      filter('uses', 'start of battle', 'ally'),
    ]);

    expect(eventActors(state, vocabulary)).toEqual(['enemy', 'self', 'ally']);
  });
});

describe('narrowEventFilters', () => {
  it('gives every event filter the actor, whatever it named', () => {
    const state = stateWith([
      filter('uses', 'attack'),
      filter('applies', 'death', 'enemy'),
      filter('kw', 'start of battle', 'any'),
    ]);

    expect(narrowEventFilters(state, vocabulary, 'self').keywords).toEqual([
      filter('uses', 'attack', 'self'),
      filter('applies', 'death', 'self'),
      filter('kw', 'start of battle', 'self'),
    ]);
  });

  it('takes the actor off with none: the events of whoever acts', () => {
    const state = stateWith([filter('uses', 'attack', 'self'), filter('applies', 'death', 'enemy')]);

    expect(narrowEventFilters(state, vocabulary, undefined).keywords).toEqual([
      filter('uses', 'attack'),
      filter('applies', 'death'),
    ]);
  });

  it('leaves the filters of other keywords, the classes, the query and every setting as they are', () => {
    const state = stateWith(
      [
        filter('applies', 'weak'),
        filter('uses', 'attack'),
        filter('kw', 'charges'),
        filter('kw', 'unheard-of', 'enemy'),
      ],
      { query: 'weak', classes: ['life'], keywordMode: 'any', artifactEligible: true, doesNotStack: true, sort: 'az' },
    );

    expect(narrowEventFilters(state, vocabulary, 'ally')).toEqual({
      ...state,
      keywords: [
        filter('applies', 'weak'),
        filter('uses', 'attack', 'ally'),
        filter('kw', 'charges'),
        filter('kw', 'unheard-of', 'enemy'),
      ],
    });
  });

  it('keeps the first of two filters that are the same once narrowed, in its place', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'attack'),
      filter('uses', 'attack'),
      filter('uses', 'attack', 'enemy'),
    ]);

    expect(narrowEventFilters(state, vocabulary, 'enemy').keywords).toEqual([
      filter('uses', 'attack', 'enemy'),
      filter('applies', 'attack', 'enemy'),
    ]);
  });

  it('gives back the very state it was given when no filter changes', () => {
    const named = stateWith([filter('applies', 'weak'), filter('uses', 'attack', 'self')]);
    const unnamed = stateWith([filter('applies', 'weak'), filter('uses', 'attack')]);

    expect(narrowEventFilters(named, vocabulary, 'self')).toBe(named);
    expect(narrowEventFilters(unnamed, vocabulary, undefined)).toBe(unnamed);
    expect(narrowEventFilters(initialExploreState, vocabulary, 'self')).toBe(initialExploreState);
  });

  describe('on any filters', () => {
    const filters = fc.array(
      fc.record(
        {
          field: fc.constantFrom('applies', 'uses', 'kw'),
          key: fc.constantFrom('attack', 'death', 'weak', 'charges', 'start of battle'),
          actor: fc.constantFrom(...KEYWORD_ACTORS),
        },
        { requiredKeys: ['field', 'key'] },
      ) satisfies fc.Arbitrary<KeywordFilter>,
    );
    const actor = fc.option(fc.constantFrom(...KEYWORD_ACTORS), { nil: undefined });
    const isEvent = ({ key }: KeywordFilter): boolean =>
      vocabulary.some((each) => each.key === key && each.kind === 'event');

    it('leaves every event filter the actor asked for, or none if there was none to narrow', () => {
      fc.assert(
        fc.property(filters, actor, (before, wanted) => {
          const after = narrowEventFilters(stateWith(before), vocabulary, wanted);
          const actors = eventActors(after, vocabulary);
          expect(actors.length === 0 || (actors.length === 1 && actors[0] === wanted)).toBe(true);
          expect(actors.length === 0).toBe(!before.some(isEvent));
        }),
      );
    });

    it('never touches the filters that are no event, nor their order', () => {
      fc.assert(
        fc.property(filters, actor, (before, wanted) => {
          const after = narrowEventFilters(stateWith(before), vocabulary, wanted).keywords;
          expect(after.filter((each) => !isEvent(each))).toEqual(before.filter((each) => !isEvent(each)));
        }),
      );
    });

    it('has the same events on, by the same field, and none twice', () => {
      fc.assert(
        fc.property(filters, actor, (before, wanted) => {
          const sidesOf = (list: readonly KeywordFilter[]) =>
            new Set(list.filter(isEvent).map(({ field, key }) => `${field}:${key}`));
          const after = narrowEventFilters(stateWith(before), vocabulary, wanted).keywords.filter(isEvent);
          expect(sidesOf(after)).toEqual(sidesOf(before));
          expect(after).toHaveLength(sidesOf(after).size);
        }),
      );
    });

    it('depends on the last actor only', () => {
      fc.assert(
        fc.property(filters, actor, actor, (before, first, second) => {
          const once = narrowEventFilters(stateWith(before), vocabulary, second);
          const twice = narrowEventFilters(
            narrowEventFilters(stateWith(before), vocabulary, first),
            vocabulary,
            second,
          );
          expect(twice.keywords).toEqual(once.keywords);
        }),
      );
    });
  });
});
