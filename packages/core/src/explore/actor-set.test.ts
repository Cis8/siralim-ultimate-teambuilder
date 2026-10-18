import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYWORD_ACTORS } from '../model/trait';
import { actorSet, actorSetKey } from './actor-set';

describe('actorSet', () => {
  it('is empty for no actor: the event whoever acts', () => {
    expect(actorSet([])).toEqual([]);
  });

  it('puts the actors in the order of the rules, whatever order they come in', () => {
    expect(actorSet(['enemy', 'self'])).toEqual(['self', 'enemy']);
    expect(actorSet(['any', 'ally', 'self', 'enemy'])).toEqual(KEYWORD_ACTORS);
  });

  it('names each actor once', () => {
    expect(actorSet(['ally', 'ally', 'self', 'ally'])).toEqual(['self', 'ally']);
  });

  it('reads any iterable', () => {
    expect(actorSet(new Set(['enemy', 'ally']))).toEqual(['ally', 'enemy']);
  });
});

describe('actorSetKey', () => {
  it('is the same text for the same actors, in whatever order', () => {
    expect(actorSetKey(['enemy', 'self'])).toBe(actorSetKey(['self', 'enemy']));
  });

  it('tells two sets of actors apart', () => {
    const sets = fc.uniqueArray(fc.constantFrom(...KEYWORD_ACTORS)).map(actorSet);
    fc.assert(
      fc.property(sets, sets, (a, b) => {
        expect(actorSetKey(a) === actorSetKey(b)).toBe(a.join() === b.join());
      }),
    );
  });

  it('is empty text for the event whoever acts', () => {
    expect(actorSetKey([])).toBe('');
  });
});
