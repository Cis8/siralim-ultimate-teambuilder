import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, RandomDebuffSource, Trait } from '../model/trait';
import { buff, debuff, effect, event, mechanic } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import type { Alternative } from './alternatives';
import { createRelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';

const taxonomy = createTaxonomy([
  debuff('Poisoned'),
  debuff('Weak'),
  debuff('Burning'),
  buff('Barrier'),
  effect('Zombies'),
  mechanic('fused', 'Fused', ['Fused']),
  event('attack', 'Attack', { group: 'actions' }),
]);

function keyword(key: string, role: KeywordRole | undefined, kind: KeywordKind = 'debuff'): KeywordHit {
  return role === undefined ? { key, kind, span: [0, key.length] } : { key, kind, role, span: [0, key.length] };
}

const applies = (...keys: string[]) => keys.map((key) => keyword(key, 'applies'));
const uses = (...keys: string[]) => keys.map((key) => keyword(key, 'uses'));

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

const enemyRandom: RandomDebuffSource = { target: 'enemy', activation: 'unconditional' };

function alternativesOf(traits: readonly Trait[], id: string, options?: RelationOptions): readonly Alternative[] {
  const found = createRelationIndex(traits, taxonomy).alternativesOf(id, options);
  if (found === undefined) throw new Error(`the index has no trait "${id}"`);
  return found;
}

const ids = (list: readonly Alternative[]) => list.map(({ trait: { id } }) => id);
const sharedBy = (list: readonly Alternative[], id: string) => list.find(({ trait }) => trait.id === id)?.shared;

describe('alternativesOf: who is listed', () => {
  it('is undefined for an id the dataset does not have', () => {
    expect(createRelationIndex([trait('a')], taxonomy).alternativesOf('b')).toBeUndefined();
  });

  it('has nobody for a trait that applies and relies on nothing', () => {
    const traits = [trait('focus'), trait('other', { keywords: applies('weak') })];

    expect(alternativesOf(traits, 'focus')).toEqual([]);
  });

  it('lists the traits that apply what the focus applies and those that rely on what it relies on, not the other way round', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...applies('poisoned')] }),
      trait('applies-the-same', { keywords: applies('poisoned') }),
      trait('relies-on-the-same', { keywords: uses('weak') }),
      trait('applies-what-it-relies-on', { keywords: applies('weak') }),
      trait('relies-on-what-it-applies', { keywords: uses('poisoned') }),
    ];

    const found = alternativesOf(traits, 'focus');

    expect(ids(found).toSorted()).toEqual(['applies-the-same', 'relies-on-the-same']);
    expect(sharedBy(found, 'applies-the-same')).toEqual([{ key: 'poisoned', role: 'applies' }]);
    expect(sharedBy(found, 'relies-on-the-same')).toEqual([{ key: 'weak', role: 'uses' }]);
  });

  it('names each key it shares with its role, in the order the focus names them', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...applies('poisoned'), ...uses('burning')] }),
      trait('twin', { keywords: [...uses('burning'), ...applies('poisoned'), ...uses('weak')] }),
    ];

    expect(sharedBy(alternativesOf(traits, 'focus'), 'twin')).toEqual([
      { key: 'weak', role: 'uses' },
      { key: 'poisoned', role: 'applies' },
      { key: 'burning', role: 'uses' },
    ]);
  });

  it('takes the two roles of one key for two ties', () => {
    const traits = [
      trait('focus', { keywords: [...applies('weak'), ...uses('weak')] }),
      trait('gives', { keywords: applies('weak') }),
      trait('both', { keywords: [...uses('weak'), ...applies('weak')] }),
    ];

    const found = alternativesOf(traits, 'focus');

    expect(ids(found)).toEqual(['both', 'gives']);
    expect(sharedBy(found, 'both')).toEqual([
      { key: 'weak', role: 'applies' },
      { key: 'weak', role: 'uses' },
    ]);
    expect(sharedBy(found, 'gives')).toEqual([{ key: 'weak', role: 'applies' }]);
  });

  it('counts a key once however many times the focus or the other trait names it', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...uses('poisoned'), ...uses('weak')] }),
      trait('other', { keywords: [...uses('weak'), ...uses('weak')] }),
    ];

    expect(sharedBy(alternativesOf(traits, 'focus'), 'other')).toEqual([{ key: 'weak', role: 'uses' }]);
  });

  it('lists a buff and an effect as it lists a debuff', () => {
    const traits = [
      trait('focus', { keywords: [keyword('barrier', 'applies', 'buff'), keyword('zombies', 'uses', 'effect')] }),
      trait('shields', { keywords: [keyword('barrier', 'applies', 'buff')] }),
      trait('needs-zombies', { keywords: [keyword('zombies', 'uses', 'effect')] }),
    ];

    expect(ids(alternativesOf(traits, 'focus')).toSorted()).toEqual(['needs-zombies', 'shields']);
  });

  it('never lists the focus', () => {
    const traits = [trait('focus', { keywords: [...applies('weak'), ...uses('weak')] })];

    expect(alternativesOf(traits, 'focus')).toEqual([]);
  });
});

describe('alternativesOf: what is no tie', () => {
  it('ignores protection, events, mechanics and keys the taxonomy does not have', () => {
    const shared = [
      keyword('weak', 'resists'),
      keyword('attack', 'uses', 'event'),
      keyword('attack', 'applies', 'event'),
      keyword('fused', undefined, 'mechanic'),
      keyword('stranger', 'uses'),
      keyword('stranger', 'applies'),
    ];
    const traits = [trait('focus', { keywords: shared }), trait('other', { keywords: shared })];

    expect(alternativesOf(traits, 'focus')).toEqual([]);
  });

  it('does not take a random or conditional source for a trait that applies by name: it applies nothing by name', () => {
    const traits = [
      trait('focus', { keywords: applies('poisoned', 'weak') }),
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('pair', { keywords: uses('poisoned', 'weak'), conditionalSources: ['poisoned', 'weak'] }),
    ];

    expect(alternativesOf(traits, 'focus')).toEqual([]);
  });

  it('lists a trait that relies on what a pair trait relies on, as it lists any other', () => {
    const traits = [
      trait('pair', { keywords: uses('poisoned', 'weak'), conditionalSources: ['poisoned', 'weak'] }),
      trait('needs-both', { keywords: uses('weak', 'poisoned') }),
    ];

    expect(ids(alternativesOf(traits, 'pair'))).toEqual(['needs-both']);
  });
});

describe('alternativesOf: the order', () => {
  const focus = trait('focus', { keywords: [...uses('weak'), ...uses('poisoned'), ...uses('burning')] });

  it('ranks by the number of keys shared, most first', () => {
    const traits = [
      focus,
      trait('one', { keywords: uses('weak') }),
      trait('three', { keywords: uses('weak', 'poisoned', 'burning') }),
      trait('two', { keywords: uses('poisoned', 'burning') }),
    ];

    expect(ids(alternativesOf(traits, 'focus'))).toEqual(['three', 'two', 'one']);
  });

  it('counts a role and a key as one tie, not the key alone', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...applies('weak')] }),
      trait('first-by-name', { keywords: uses('weak') }),
      trait('second-by-name', { keywords: [...uses('weak'), ...applies('weak')] }),
    ];

    expect(ids(alternativesOf(traits, 'focus'))).toEqual(['second-by-name', 'first-by-name']);
  });

  it('then by name regardless of case, then by the exact name, then by id', () => {
    const traits = [
      focus,
      trait('i1', { name: 'b', keywords: uses('weak') }),
      trait('i2', { name: 'a', keywords: uses('weak') }),
      trait('i3', { name: 'A', keywords: uses('weak') }),
      trait('z-same', { name: 'Same', keywords: uses('weak') }),
      trait('a-same', { name: 'Same', keywords: uses('weak') }),
    ];

    expect(ids(alternativesOf(traits, 'focus'))).toEqual(['i3', 'i2', 'i1', 'a-same', 'z-same']);
  });
});

describe('alternativesOf: only artifact-eligible traits', () => {
  const traits = [
    trait('focus', { keywords: uses('weak', 'poisoned'), material: null }),
    trait('with-material', { keywords: uses('weak') }),
    trait('no-material', { keywords: uses('weak', 'poisoned'), material: null }),
    trait('also-with-material', { keywords: uses('poisoned') }),
  ];

  it('keeps every trait by default', () => {
    expect(ids(alternativesOf(traits, 'focus'))).toEqual(['no-material', 'also-with-material', 'with-material']);
    expect(alternativesOf(traits, 'focus', { artifactOnly: false })).toEqual(alternativesOf(traits, 'focus'));
  });

  it('drops a trait without material and keeps the order of the others', () => {
    expect(ids(alternativesOf(traits, 'focus', { artifactOnly: true }))).toEqual([
      'also-with-material',
      'with-material',
    ]);
  });

  it('still reads a focus that has no material', () => {
    expect(alternativesOf(traits, 'focus', { artifactOnly: true })).not.toEqual([]);
  });
});

describe('alternativesOf: invariants', () => {
  interface TraitShape {
    readonly keywords: readonly { readonly key: string; readonly role: KeywordRole | undefined }[];
    readonly hasMaterial: boolean;
  }
  // Dense on purpose: a few keys and mostly the two roles that count, or two traits would rarely share one.
  const shapesArbitrary = fc.array<TraitShape>(
    fc.record({
      keywords: fc.array(
        fc.record({
          key: fc.oneof(
            { weight: 5, arbitrary: fc.constantFrom('poisoned', 'weak', 'burning', 'barrier') },
            { weight: 1, arbitrary: fc.constantFrom('zombies', 'attack', 'fused', 'unknown') },
          ),
          role: fc.constantFrom<KeywordRole | undefined>('applies', 'applies', 'uses', 'uses', 'resists', undefined),
        }),
        { maxLength: 6 },
      ),
      hasMaterial: fc.boolean(),
    }),
    { maxLength: 16 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ keywords, hasMaterial }, position) =>
      trait(`t${position}`, {
        keywords: keywords.map(({ key, role }) => keyword(key, role, taxonomy.get(key)?.kind ?? 'debuff')),
        material: hasMaterial ? 'Ferrous Ore' : null,
      }),
    );
  /** The ties of a trait, found with no help from the index: the keys of the taxonomy that are no event, in a role that counts. */
  const tiesOf = (subject: Trait) => [
    ...new Set(
      subject.keywords.flatMap(({ key, role }) =>
        (role === 'applies' || role === 'uses') && ['poisoned', 'weak', 'burning', 'barrier', 'zombies'].includes(key)
          ? [`${role}:${key}`]
          : [],
      ),
    ),
  ];

  it('lists exactly the other traits that share a tie with the focus, once, with the ties they share', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const found = alternativesOf(traits, focus.id);
          const focusTies = tiesOf(focus);
          const expected = traits
            .filter((other) => other !== focus && tiesOf(other).some((tie) => focusTies.includes(tie)))
            .map(({ id }) => id);

          expect(ids(found).toSorted()).toEqual(expected.toSorted());
          for (const { trait: other, shared } of found) {
            expect(shared.map(({ role, key }) => `${role}:${key}`)).toEqual(
              focusTies.filter((tie) => tiesOf(other).includes(tie)),
            );
          }
        }
      }),
    );
  });

  it('is ranked by the number of keys shared, then by name and id', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const found = alternativesOf(traits, focus.id);
          for (const [at, entry] of found.entries()) {
            const before = found[at - 1];
            if (before === undefined) continue;
            expect(before.shared.length).toBeGreaterThanOrEqual(entry.shared.length);
            if (before.shared.length === entry.shared.length) {
              expect(before.trait.id < entry.trait.id).toBe(true);
            }
          }
        }
      }),
      // Two candidates that tie are rare in the default hundred runs.
      { numRuns: 500 },
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
              expect(alternativesOf(shuffled, focus.id, options)).toEqual(alternativesOf(traits, focus.id, options));
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
          expect(alternativesOf(traits, focus.id, { artifactOnly: true })).toEqual(
            alternativesOf(traits, focus.id).filter(({ trait: { material } }) => material !== null),
          );
        }
      }),
    );
  });

  it('is symmetric: A is an alternative of B through the same ties as B is of A', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const tiesBetween = (focus: Trait, other: Trait) =>
          sharedBy(alternativesOf(traits, focus.id), other.id)
            ?.map(({ role, key }) => `${role}:${key}`)
            .toSorted();
        for (const a of traits) {
          for (const b of traits) {
            if (a !== b) expect(tiesBetween(a, b)).toEqual(tiesBetween(b, a));
          }
        }
      }),
    );
  });
});
