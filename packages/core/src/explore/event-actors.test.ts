import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS, type KeywordActor } from '../model/trait';
import { actorSet, type ActorSet } from './actor-set';
import { eventActors, setEventActors, toggleActor } from './event-actors';
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

  it('is the actors of the event filters, once, when every side names the same', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'death', 'self'),
      filter('kw', 'weak'),
    ]);

    expect(eventActors(state, vocabulary)).toEqual([['self']]);
  });

  it('is the actors that the filters of one side name together', () => {
    const state = stateWith([filter('uses', 'attack', 'enemy'), filter('uses', 'attack', 'self')]);

    expect(eventActors(state, vocabulary)).toEqual([['self', 'enemy']]);
  });

  it('agrees whatever the order the actors were chosen in', () => {
    const state = stateWith([
      filter('uses', 'attack', 'enemy'),
      filter('uses', 'attack', 'self'),
      filter('applies', 'death', 'self'),
      filter('applies', 'death', 'enemy'),
    ]);

    expect(eventActors(state, vocabulary)).toEqual([['self', 'enemy']]);
  });

  it('is empty for a side whose filters name no actor: the event whoever acts', () => {
    expect(eventActors(stateWith([filter('uses', 'attack'), filter('uses', 'death')]), vocabulary)).toEqual([[]]);
  });

  it('is empty for a side that is on for anyone as well as for an actor: anyone includes the actor', () => {
    const state = stateWith([filter('uses', 'attack', 'self'), filter('uses', 'attack')]);

    expect(eventActors(state, vocabulary)).toEqual([[]]);
  });

  it('lists the sets that differ, in the order of the sides', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('uses', 'death'),
      filter('applies', 'attack', 'self'),
      filter('uses', 'start of battle', 'ally'),
    ]);

    expect(eventActors(state, vocabulary)).toEqual([['self'], [], ['ally']]);
  });

  it('keeps the actor "any creature", which a text says and the panel does not offer', () => {
    expect(eventActors(stateWith([filter('uses', 'attack', 'any')]), vocabulary)).toEqual([['any']]);
  });
});

describe('setEventActors', () => {
  it('gives every event side the actors, one filter each, whatever it named', () => {
    const state = stateWith([
      filter('uses', 'attack'),
      filter('applies', 'death', 'enemy'),
      filter('kw', 'start of battle', 'any'),
    ]);

    expect(setEventActors(state, vocabulary, ['self']).keywords).toEqual([
      filter('uses', 'attack', 'self'),
      filter('applies', 'death', 'self'),
      filter('kw', 'start of battle', 'self'),
    ]);
  });

  it('gives a side with several actors a filter for each, in the order of the rules', () => {
    const state = stateWith([filter('uses', 'attack'), filter('applies', 'death')]);

    expect(setEventActors(state, vocabulary, actorSet(['enemy', 'self'])).keywords).toEqual([
      filter('uses', 'attack', 'self'),
      filter('uses', 'attack', 'enemy'),
      filter('applies', 'death', 'self'),
      filter('applies', 'death', 'enemy'),
    ]);
  });

  it('takes the actors off with none: the events of whoever acts', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('uses', 'attack', 'enemy'),
      filter('applies', 'death', 'enemy'),
    ]);

    expect(setEventActors(state, vocabulary, []).keywords).toEqual([
      filter('uses', 'attack'),
      filter('applies', 'death'),
    ]);
  });

  it('adds an actor after the filters of its side, and takes one off where it stood', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'weak'),
      filter('uses', 'death', 'self'),
    ]);

    expect(setEventActors(state, vocabulary, ['self', 'enemy']).keywords).toEqual([
      filter('uses', 'attack', 'self'),
      filter('uses', 'attack', 'enemy'),
      filter('applies', 'weak'),
      filter('uses', 'death', 'self'),
      filter('uses', 'death', 'enemy'),
    ]);
    expect(setEventActors(state, vocabulary, ['enemy']).keywords).toEqual([
      filter('uses', 'attack', 'enemy'),
      filter('applies', 'weak'),
      filter('uses', 'death', 'enemy'),
    ]);
  });

  it('keeps the filters that are right where they stand, and puts what is missing after the last of them', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'weak'),
      filter('uses', 'attack', 'enemy'),
      filter('kw', 'charges'),
    ]);

    expect(setEventActors(state, vocabulary, ['ally', 'enemy']).keywords).toEqual([
      filter('applies', 'weak'),
      filter('uses', 'attack', 'enemy'),
      filter('uses', 'attack', 'ally'),
      filter('kw', 'charges'),
    ]);
  });

  it('is one filter where two become the same: the one that was right already, or the first', () => {
    const state = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'attack'),
      filter('uses', 'attack'),
      filter('uses', 'attack', 'enemy'),
    ]);

    expect(setEventActors(state, vocabulary, ['enemy']).keywords).toEqual([
      filter('applies', 'attack', 'enemy'),
      filter('uses', 'attack', 'enemy'),
    ]);
    expect(setEventActors(state, vocabulary, []).keywords).toEqual([
      filter('applies', 'attack'),
      filter('uses', 'attack'),
    ]);
    expect(
      setEventActors(stateWith([filter('uses', 'attack', 'self'), filter('uses', 'attack', 'self')]), vocabulary, [
        'self',
      ]).keywords,
    ).toEqual([filter('uses', 'attack', 'self')]);
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

    expect(setEventActors(state, vocabulary, ['ally', 'enemy'])).toEqual({
      ...state,
      keywords: [
        filter('applies', 'weak'),
        filter('uses', 'attack', 'ally'),
        filter('uses', 'attack', 'enemy'),
        filter('kw', 'charges'),
        filter('kw', 'unheard-of', 'enemy'),
      ],
    });
  });

  it('gives back the very state it was given when no filter changes', () => {
    const named = stateWith([filter('applies', 'weak'), filter('uses', 'attack', 'self')]);
    const unnamed = stateWith([filter('applies', 'weak'), filter('uses', 'attack')]);
    const apart = stateWith([
      filter('uses', 'attack', 'self'),
      filter('applies', 'weak'),
      filter('uses', 'attack', 'enemy'),
    ]);

    expect(setEventActors(named, vocabulary, ['self'])).toBe(named);
    expect(setEventActors(unnamed, vocabulary, [])).toBe(unnamed);
    expect(setEventActors(apart, vocabulary, ['self', 'enemy'])).toBe(apart);
    expect(setEventActors(initialExploreState, vocabulary, ['self'])).toBe(initialExploreState);
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
    const actors = fc.uniqueArray(fc.constantFrom(...KEYWORD_ACTORS)).map(actorSet);
    const isEvent = ({ key }: KeywordFilter): boolean =>
      vocabulary.some((each) => each.key === key && each.kind === 'event');
    const sideOf = ({ field, key }: KeywordFilter): string => `${field}:${key}`;

    it('leaves every event side with the actors asked for, or none if there was none to set', () => {
      fc.assert(
        fc.property(filters, actors, (before, wanted) => {
          const after = eventActors(setEventActors(stateWith(before), vocabulary, wanted), vocabulary);
          if (before.some(isEvent)) expect(after).toEqual([wanted]);
          else expect(after).toEqual([]);
        }),
      );
    });

    it('never touches the filters that are no event, nor their order', () => {
      fc.assert(
        fc.property(filters, actors, (before, wanted) => {
          const after = setEventActors(stateWith(before), vocabulary, wanted).keywords;
          expect(after.filter((each) => !isEvent(each))).toEqual(before.filter((each) => !isEvent(each)));
        }),
      );
    });

    it('has the same events on, by the same field, and no filter twice', () => {
      fc.assert(
        fc.property(filters, actors, (before, wanted) => {
          const sidesOf = (list: readonly KeywordFilter[]) => new Set(list.filter(isEvent).map(sideOf));
          const after = setEventActors(stateWith(before), vocabulary, wanted).keywords.filter(isEvent);
          expect(sidesOf(after)).toEqual(sidesOf(before));
          expect(after).toHaveLength(sidesOf(after).size * Math.max(wanted.length, 1));
          expect(new Set(after.map((each) => `${sideOf(each)}/${each.actor ?? ''}`)).size).toBe(after.length);
        }),
      );
    });

    it('depends on the last actors only', () => {
      fc.assert(
        fc.property(filters, actors, actors, (before, first, second) => {
          const once = setEventActors(stateWith(before), vocabulary, second);
          const twice = setEventActors(setEventActors(stateWith(before), vocabulary, first), vocabulary, second);
          expect(eventActors(twice, vocabulary)).toEqual(eventActors(once, vocabulary));
          expect(new Set(twice.keywords.map((each) => JSON.stringify(each)))).toEqual(
            new Set(once.keywords.map((each) => JSON.stringify(each))),
          );
        }),
      );
    });

    it('changes nothing when asked for what the filters already are', () => {
      fc.assert(
        fc.property(filters, actors, (before, wanted) => {
          const set = setEventActors(stateWith(before), vocabulary, wanted);
          expect(setEventActors(set, vocabulary, wanted)).toBe(set);
        }),
      );
    });
  });
});

describe('toggleActor', () => {
  it('adds an actor to none, which was the event whoever acts', () => {
    expect(toggleActor([], 'self')).toEqual(['self']);
  });

  it('adds an actor to the others, in the order of the rules', () => {
    expect(toggleActor(['enemy'], 'self')).toEqual(['self', 'enemy']);
    expect(toggleActor(['self'], 'enemy')).toEqual(['self', 'enemy']);
    expect(toggleActor(['self', 'enemy'], 'ally')).toEqual(['self', 'ally', 'enemy']);
  });

  it('takes an actor off when it was there', () => {
    expect(toggleActor(['self', 'enemy'], 'self')).toEqual(['enemy']);
  });

  it('is none when the last actor goes: the event whoever acts', () => {
    expect(toggleActor(['ally'], 'ally')).toEqual([]);
  });

  it('is that actor alone when the filters name different actors, so that a press makes them one', () => {
    expect(toggleActor(undefined, 'ally')).toEqual(['ally']);
  });

  it('keeps "any creature", which the panel cannot turn on or off', () => {
    expect(toggleActor(['any'], 'self')).toEqual(['self', 'any']);
    expect(toggleActor(['self', 'any'], 'self')).toEqual(['any']);
  });

  it('is undone by a second toggle', () => {
    const actors = fc.uniqueArray(fc.constantFrom(...KEYWORD_ACTORS)).map(actorSet);
    fc.assert(
      fc.property(actors, fc.constantFrom(...KEYWORD_ACTORS), (shown: ActorSet, actor) => {
        expect(toggleActor(toggleActor(shown, actor), actor)).toEqual(shown);
      }),
    );
  });
});
