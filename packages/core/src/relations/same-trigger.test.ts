import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordActor, KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { debuff, event } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import { createRelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';
import type { SameTrigger, TriggerMatch } from './same-trigger';

const taxonomy = createTaxonomy([
  debuff('Weak'),
  event('start of battle', 'Start of battle', { group: 'battle', phase: 'startOfBattle', moment: true }),
  event('attack', 'Attack', { group: 'actions', phase: 'attacking' }),
  event('being attacked', 'Being attacked', { group: 'hits', phase: 'beingAttacked' }),
  event('cast spell', 'Cast spell', { group: 'actions', phase: 'spellcasting' }),
]);

function hit(key: string, kind: KeywordKind, role: KeywordRole | undefined, actor?: KeywordActor): KeywordHit {
  const base = { key, kind, span: [0, key.length] as const };
  return { ...base, ...(role === undefined ? {} : { role }), ...(actor === undefined ? {} : { actor }) };
}

/** A trait waits for the events: `waits('attack', 'self')` is "after this creature attacks"; no actor, the text names none. */
const waits = (key: string, actor?: KeywordActor) => hit(key, 'event', 'uses', actor);
/** A trait makes the event happen. */
const causes = (key: string, actor?: KeywordActor) => hit(key, 'event', 'applies', actor);

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Ferrous Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

function sameTriggerOf(traits: readonly Trait[], id: string, options?: RelationOptions): SameTrigger {
  const found = createRelationIndex(traits, taxonomy).sameTriggerOf(id, options);
  if (found === undefined) throw new Error(`the index has no trait "${id}"`);
  return found;
}

const ids = (entries: readonly TriggerMatch[]) => entries.map(({ trait: { id } }) => id);
const sharedBy = (found: SameTrigger, id: string) => found.entries.find(({ trait }) => trait.id === id)?.shared;

describe('sameTriggerOf: the state of a trait with no trigger', () => {
  it('is undefined for an id the dataset does not have', () => {
    expect(createRelationIndex([trait('a')], taxonomy).sameTriggerOf('b')).toBeUndefined();
  });

  it('has no trigger and nobody for a trait that waits for no event, whoever else does', () => {
    const traits = [trait('focus'), trait('other', { keywords: [waits('attack', 'self')] })];

    expect(sameTriggerOf(traits, 'focus')).toEqual({ triggers: [], entries: [] });
  });

  it('does not take an event the trait makes happen, or one it prevents, for a trigger', () => {
    const traits = [
      trait('focus', { keywords: [causes('attack', 'self'), hit('cast spell', 'event', 'resists')] }),
      trait('causes-too', { keywords: [causes('attack', 'self')] }),
      trait('waits', { keywords: [waits('attack', 'self'), waits('cast spell')] }),
    ];

    expect(sameTriggerOf(traits, 'focus')).toEqual({ triggers: [], entries: [] });
  });

  it('does not take a buff or a debuff for a trigger, nor a mention that has no role', () => {
    const traits = [
      trait('focus', { keywords: [hit('weak', 'debuff', 'uses'), hit('attack', 'event', undefined)] }),
      trait('other', { keywords: [hit('weak', 'debuff', 'uses'), hit('attack', 'event', undefined)] }),
    ];

    expect(sameTriggerOf(traits, 'focus')).toEqual({ triggers: [], entries: [] });
  });

  it('does not take for a trigger an event the taxonomy does not have', () => {
    const traits = [
      trait('focus', { keywords: [waits('stranger')] }),
      trait('other', { keywords: [waits('stranger')] }),
    ];

    expect(sameTriggerOf(traits, 'focus')).toEqual({ triggers: [], entries: [] });
  });
});

describe('sameTriggerOf: who is listed', () => {
  it('names the events the trait waits for, once each, in the order it names them', () => {
    const traits = [
      trait('focus', {
        keywords: [waits('cast spell', 'self'), waits('attack', 'self'), waits('cast spell', 'ally')],
      }),
    ];

    expect(sameTriggerOf(traits, 'focus').triggers).toEqual(['cast spell', 'attack']);
  });

  it('lists the traits that wait for one of its events, with the events they share in the order the focus names them', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self'), waits('cast spell', 'self')] }),
      trait('attacks', { keywords: [waits('attack', 'self')] }),
      trait('both', { keywords: [waits('cast spell', 'self'), waits('attack', 'self')] }),
      trait('elsewhere', { keywords: [waits('being attacked', 'self')] }),
    ];

    const found = sameTriggerOf(traits, 'focus');

    expect(ids(found.entries)).toEqual(['both', 'attacks']);
    expect(sharedBy(found, 'both')).toEqual(['attack', 'cast spell']);
    expect(sharedBy(found, 'attacks')).toEqual(['attack']);
  });

  it('tells moments of a battle apart by their key, as they have no actor', () => {
    const traits = [
      trait('focus', { keywords: [waits('start of battle')] }),
      trait('same-moment', { keywords: [waits('start of battle')] }),
      trait('other-moment', { keywords: [waits('attack', 'self')] }),
    ];

    expect(ids(sameTriggerOf(traits, 'focus').entries)).toEqual(['same-moment']);
  });

  it('counts an event once however many times either trait names it', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self'), waits('attack', 'ally')] }),
      trait('other', { keywords: [waits('attack', 'self'), waits('attack', 'self'), waits('attack', 'ally')] }),
    ];

    expect(sharedBy(sameTriggerOf(traits, 'focus'), 'other')).toEqual(['attack']);
  });

  it('does not list a trait that only makes the event happen', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self')] }),
      trait('causes', { keywords: [causes('attack', 'self')] }),
      trait('causes-and-waits-elsewhere', { keywords: [causes('attack', 'self'), waits('cast spell', 'self')] }),
    ];

    expect(sameTriggerOf(traits, 'focus').entries).toEqual([]);
  });

  it('never lists the focus', () => {
    const traits = [trait('focus', { keywords: [waits('attack', 'self')] })];

    expect(sameTriggerOf(traits, 'focus')).toEqual({ triggers: ['attack'], entries: [] });
  });
});

describe('sameTriggerOf: who does it', () => {
  const sameEvent = (focusActor?: KeywordActor, otherActor?: KeywordActor) =>
    ids(
      sameTriggerOf(
        [
          trait('focus', { keywords: [waits('attack', focusActor)] }),
          trait('other', { keywords: [waits('attack', otherActor)] }),
        ],
        'focus',
      ).entries,
    );

  it('matches the same actor', () => {
    for (const actor of ['self', 'ally', 'enemy', 'any'] as const)
      expect(sameEvent(actor, actor), actor).toEqual(['other']);
  });

  it('does not match an actor with another one: this creature, your creatures and the enemy are different', () => {
    expect(sameEvent('self', 'ally')).toEqual([]);
    expect(sameEvent('ally', 'self')).toEqual([]);
    expect(sameEvent('self', 'enemy')).toEqual([]);
    expect(sameEvent('enemy', 'ally')).toEqual([]);
  });

  it('matches a text that names nobody with every actor, on either side', () => {
    for (const actor of ['self', 'ally', 'enemy', 'any'] as const) {
      expect(sameEvent(undefined, actor), `focus names nobody, other ${actor}`).toEqual(['other']);
      expect(sameEvent(actor, undefined), `focus ${actor}, other names nobody`).toEqual(['other']);
    }
    expect(sameEvent(undefined, undefined)).toEqual(['other']);
  });

  it('matches any creature with every actor, on either side', () => {
    for (const actor of ['self', 'ally', 'enemy'] as const) {
      expect(sameEvent('any', actor), `focus any, other ${actor}`).toEqual(['other']);
      expect(sameEvent(actor, 'any'), `focus ${actor}, other any`).toEqual(['other']);
    }
  });

  it('matches when any pair of the actors the two traits name for the event is compatible', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self'), waits('attack', 'enemy')] }),
      trait('enemy-too', { keywords: [waits('attack', 'ally'), waits('attack', 'enemy')] }),
      trait('allies-only', { keywords: [waits('attack', 'ally')] }),
    ];

    expect(ids(sameTriggerOf(traits, 'focus').entries)).toEqual(['enemy-too']);
  });

  it('reads the actor of each event on its own: a shared actor on another event is no match', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self'), waits('cast spell', 'ally')] }),
      trait('crossed', { keywords: [waits('attack', 'ally'), waits('cast spell', 'self')] }),
    ];

    expect(sameTriggerOf(traits, 'focus').entries).toEqual([]);
  });

  it('keeps an event where the focus first names it, though only a later mention of it fits the other trait', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'ally'), waits('start of battle'), waits('attack', 'self')] }),
      trait('other', { keywords: [waits('start of battle'), waits('attack', 'self')] }),
    ];

    expect(sharedBy(sameTriggerOf(traits, 'focus'), 'other')).toEqual(['attack', 'start of battle']);
  });

  it('counts only the events whose actors are compatible', () => {
    const traits = [
      trait('focus', { keywords: [waits('attack', 'self'), waits('cast spell', 'ally')] }),
      trait('half', { keywords: [waits('attack', 'self'), waits('cast spell', 'self')] }),
    ];

    expect(sharedBy(sameTriggerOf(traits, 'focus'), 'half')).toEqual(['attack']);
  });
});

describe('sameTriggerOf: the order', () => {
  const focus = trait('focus', {
    keywords: [waits('attack', 'self'), waits('cast spell', 'self'), waits('being attacked', 'self')],
  });

  it('ranks by the number of events shared, most first', () => {
    const traits = [
      focus,
      trait('one', { keywords: [waits('attack', 'self')] }),
      trait('three', {
        keywords: [waits('attack', 'self'), waits('cast spell', 'self'), waits('being attacked', 'self')],
      }),
      trait('two', { keywords: [waits('being attacked', 'self'), waits('cast spell', 'self')] }),
    ];

    expect(ids(sameTriggerOf(traits, 'focus').entries)).toEqual(['three', 'two', 'one']);
  });

  it('then by name regardless of case, then by the exact name, then by id', () => {
    const traits = [
      focus,
      trait('i1', { name: 'b', keywords: [waits('attack', 'self')] }),
      trait('i2', { name: 'a', keywords: [waits('attack', 'self')] }),
      trait('i3', { name: 'A', keywords: [waits('attack', 'self')] }),
      trait('z-same', { name: 'Same', keywords: [waits('attack', 'self')] }),
      trait('a-same', { name: 'Same', keywords: [waits('attack', 'self')] }),
    ];

    expect(ids(sameTriggerOf(traits, 'focus').entries)).toEqual(['i3', 'i2', 'i1', 'a-same', 'z-same']);
  });
});

describe('sameTriggerOf: only artifact-eligible traits', () => {
  const traits = [
    trait('focus', { keywords: [waits('attack', 'self')], material: null }),
    trait('with-material', { keywords: [waits('attack', 'self')] }),
    trait('no-material', { keywords: [waits('attack', 'self')], material: null }),
  ];

  it('keeps every trait by default', () => {
    expect(ids(sameTriggerOf(traits, 'focus').entries)).toEqual(['no-material', 'with-material']);
    expect(sameTriggerOf(traits, 'focus', { artifactOnly: false })).toEqual(sameTriggerOf(traits, 'focus'));
  });

  it('drops a trait without material, and still reads a focus that has none', () => {
    expect(sameTriggerOf(traits, 'focus', { artifactOnly: true })).toEqual({
      triggers: ['attack'],
      entries: [{ trait: traits[1], shared: ['attack'] }],
    });
  });
});

describe('sameTriggerOf: invariants', () => {
  interface TraitShape {
    readonly events: readonly {
      readonly key: string;
      readonly role: KeywordRole | undefined;
      readonly actor: KeywordActor | undefined;
    }[];
    readonly hasMaterial: boolean;
  }
  const shapesArbitrary = fc.array<TraitShape>(
    fc.record({
      events: fc.array(
        fc.record({
          key: fc.constantFrom('attack', 'cast spell', 'being attacked', 'start of battle', 'stranger'),
          role: fc.constantFrom<KeywordRole | undefined>('uses', 'uses', 'uses', 'applies', 'resists', undefined),
          actor: fc.constantFrom<KeywordActor | undefined>('self', 'ally', 'enemy', 'any', undefined),
        }),
        { maxLength: 5 },
      ),
      hasMaterial: fc.boolean(),
    }),
    { maxLength: 16 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ events, hasMaterial }, position) =>
      trait(`t${position}`, {
        keywords: events.map(({ key, role, actor }) => hit(key, 'event', role, actor)),
        material: hasMaterial ? 'Ferrous Ore' : null,
      }),
    );
  const compatible = (a: KeywordActor | undefined, b: KeywordActor | undefined) =>
    a === undefined || b === undefined || a === 'any' || b === 'any' || a === b;
  const known = ['attack', 'cast spell', 'being attacked', 'start of battle'];
  /** The events a trait waits for, once each, in the order it names them: found with no help from the index. */
  const eventsOf = (subject: Trait) => [
    ...new Set(
      subject.keywords.filter(({ key, role }) => role === 'uses' && known.includes(key)).map(({ key }) => key),
    ),
  ];
  /** Of those, the events the other trait waits for too with an actor that fits one of the focus's. */
  const sharedEvents = (focus: Trait, other: Trait) =>
    eventsOf(focus).filter((event) =>
      focus.keywords.some(
        (own) =>
          own.role === 'uses' &&
          own.key === event &&
          other.keywords.some(
            (theirs) => theirs.role === 'uses' && theirs.key === event && compatible(own.actor, theirs.actor),
          ),
      ),
    );

  it('lists exactly the other traits that wait for an event of the focus with a compatible actor, once, with the events shared', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const { triggers, entries } = sameTriggerOf(traits, focus.id);
          const expected = traits.filter((other) => other !== focus && sharedEvents(focus, other).length > 0);

          expect(ids(entries).toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
          for (const { trait: other, shared } of entries) expect(shared).toEqual(sharedEvents(focus, other));
          expect(triggers).toEqual(eventsOf(focus));
        }
      }),
    );
  });

  it('is ranked by the number of events shared, then by name and id', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const { entries } = sameTriggerOf(traits, focus.id);
          for (const [at, entry] of entries.entries()) {
            const before = entries[at - 1];
            if (before === undefined) continue;
            expect(before.shared.length).toBeGreaterThanOrEqual(entry.shared.length);
            if (before.shared.length === entry.shared.length) expect(before.trait.id < entry.trait.id).toBe(true);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('is symmetric: A is listed for B with the events that B is listed with for A', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const between = (focus: Trait, other: Trait) => sharedBy(sameTriggerOf(traits, focus.id), other.id)?.toSorted();
        for (const a of traits) {
          for (const b of traits) {
            if (a !== b) expect(between(a, b)).toEqual(between(b, a));
          }
        }
      }),
    );
  });

  it('is the same whatever the order the traits were given in', () => {
    fc.assert(
      fc.property(
        shapesArbitrary.chain((shapes) => {
          const traits = build(shapes);
          return fc.tuple(
            fc.constant(traits),
            fc.shuffledSubarray(traits, { minLength: traits.length, maxLength: traits.length }),
          );
        }),
        ([traits, shuffled]) => {
          for (const focus of traits) {
            for (const options of [{}, { artifactOnly: true }]) {
              expect(sameTriggerOf(shuffled, focus.id, options)).toEqual(sameTriggerOf(traits, focus.id, options));
            }
          }
        },
      ),
    );
  });

  it('with the artifact filter keeps, in the same order, the traits with material of the whole list', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const whole = sameTriggerOf(traits, focus.id);
          expect(sameTriggerOf(traits, focus.id, { artifactOnly: true })).toEqual({
            triggers: whole.triggers,
            entries: whole.entries.filter(({ trait: { material } }) => material !== null),
          });
        }
      }),
    );
  });
});
