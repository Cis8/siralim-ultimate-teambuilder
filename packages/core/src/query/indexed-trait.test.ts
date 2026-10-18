import { describe, expect, it } from 'vitest';
import type { KeywordActor, KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { indexTrait } from './indexed-trait';

function trait(overrides: Partial<Trait> = {}): Trait {
  return {
    id: 'abomination--flesh-rot',
    name: 'Flesh Rot',
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const hit = (key: string, kind: KeywordKind, role?: KeywordRole): KeywordHit => ({
  key,
  kind,
  ...(role === undefined ? {} : { role }),
  span: [0, key.length],
});

describe('indexTrait', () => {
  it('keeps the trait it was made from', () => {
    const source = trait();
    expect(indexTrait(source).trait).toBe(source);
  });

  it('lower-cases the columns the fields read', () => {
    expect(indexTrait(trait({ description: 'Applies Vulnerable.' })).columns).toEqual({
      class: 'death',
      family: 'abomination',
      creature: 'abomination brute',
      name: 'flesh rot',
      description: 'applies vulnerable.',
      material: 'brute stitches',
    });
  });

  it('leaves a column empty where the trait has none: a mastery has no creature, a trait may have no material', () => {
    const { columns } = indexTrait(trait({ kind: 'mastery', creature: null, material: null }));
    expect(columns.creature).toBe('');
    expect(columns.material).toBe('');
  });

  describe('keywords', () => {
    const keywords = [
      hit('vulnerable', 'debuff', 'applies'),
      hit('weak', 'debuff', 'uses'),
      hit('silenced', 'debuff', 'resists'),
      hit('barrier', 'buff', 'applies'),
      hit('dire wolves', 'effect', 'uses'),
      hit('start of battle', 'event'),
      hit('fused', 'mechanic'),
    ];
    const indexed = indexTrait(trait({ keywords }));

    it('lists the keys the trait applies, by role', () => {
      expect(indexed.applies).toEqual(['vulnerable', 'barrier']);
    });

    it('lists the keys the trait relies on, by role', () => {
      expect(indexed.uses).toEqual(['weak', 'dire wolves']);
    });

    it('counts a mention that only guards against a keyword in neither role (GAME_RULES R9)', () => {
      expect(indexed.applies).not.toContain('silenced');
      expect(indexed.uses).not.toContain('silenced');
    });

    it('lists every key in `keywords`, whatever its kind and role, in order of appearance', () => {
      expect(indexed.keywords).toEqual([
        'vulnerable',
        'weak',
        'silenced',
        'barrier',
        'dire wolves',
        'start of battle',
        'fused',
      ]);
    });

    it('lists a key once however many times it is mentioned', () => {
      const twice = indexTrait(
        trait({
          keywords: [
            hit('weak', 'debuff', 'applies'),
            hit('barrier', 'buff', 'applies'),
            hit('weak', 'debuff', 'applies'),
          ],
        }),
      );
      expect(twice.applies).toEqual(['weak', 'barrier']);
      expect(twice.keywords).toEqual(['weak', 'barrier']);
    });

    it('lists a key under both roles when the trait both gives and relies on it', () => {
      const both = indexTrait(trait({ keywords: [hit('weak', 'debuff', 'applies'), hit('weak', 'debuff', 'uses')] }));
      expect(both.applies).toEqual(['weak']);
      expect(both.uses).toEqual(['weak']);
      expect(both.keywords).toEqual(['weak']);
    });

    it('has no keys for a trait that mentions none', () => {
      const none = indexTrait(trait());
      expect([none.applies, none.uses, none.keywords]).toEqual([[], [], []]);
    });
  });

  // An event is also listed with the actor the text names (GAME_RULES R12), beside the key alone, so that a query can ask for
  // an event by anyone or by one actor.
  describe('events with an actor', () => {
    const event = (key: string, role: KeywordRole, actor?: KeywordActor): KeywordHit => ({
      ...hit(key, 'event', role),
      ...(actor === undefined ? {} : { actor }),
    });
    const indexed = indexTrait(
      trait({
        keywords: [
          event('attack', 'uses', 'self'),
          event('death', 'applies', 'enemy'),
          event('start of battle', 'uses'),
          event('dodge', 'resists', 'self'),
          hit('weak', 'debuff', 'uses'),
          event('attack', 'uses', 'ally'),
        ],
      }),
    );

    it('keeps the key alone in the lists of keys, whoever acts, so that the facets count it once', () => {
      expect(indexed.uses).toEqual(['attack', 'start of battle', 'weak']);
      expect(indexed.applies).toEqual(['death']);
      expect(indexed.keywords).toEqual(['attack', 'death', 'start of battle', 'dodge', 'weak']);
    });

    it('lists the key with its actor under the role of the mention', () => {
      expect(indexed.acted.uses).toEqual([
        { key: 'attack', actor: 'self' },
        { key: 'attack', actor: 'ally' },
      ]);
      expect(indexed.acted.applies).toEqual([{ key: 'death', actor: 'enemy' }]);
    });

    it('lists every mention that names an actor in `keywords`, whatever its role', () => {
      expect(indexed.acted.keywords).toEqual([
        { key: 'attack', actor: 'self' },
        { key: 'death', actor: 'enemy' },
        { key: 'dodge', actor: 'self' },
        { key: 'attack', actor: 'ally' },
      ]);
    });

    it('leaves out a mention that names nobody', () => {
      const nobody = indexTrait(trait({ keywords: [event('start of battle', 'uses'), hit('weak', 'debuff', 'uses')] }));
      expect(nobody.acted).toEqual({ applies: [], uses: [], keywords: [] });
    });

    it('lists a key and an actor once however many times it is mentioned', () => {
      const twice = indexTrait(trait({ keywords: [event('attack', 'uses', 'self'), event('attack', 'uses', 'self')] }));
      expect(twice.acted.uses).toEqual([{ key: 'attack', actor: 'self' }]);
    });
  });
});
