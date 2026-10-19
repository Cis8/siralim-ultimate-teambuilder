import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait, TraitKind } from '../model/trait';
import { createTaxonomy } from '../taxonomy/registry';
import { createRelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';
import type { SameFamily } from './same-family';

const taxonomy = createTaxonomy([]);

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

const mastery = (id: string, family: string, overrides: Partial<Trait> = {}) =>
  trait(id, { kind: 'mastery', creature: null, family, masteryFamily: family, ...overrides });

function sameFamilyOf(traits: readonly Trait[], id: string, options?: RelationOptions): SameFamily {
  const found = createRelationIndex(traits, taxonomy).sameFamilyOf(id, options);
  if (found === undefined) throw new Error(`the index has no trait "${id}"`);
  return found;
}

const ids = (found: SameFamily) => found.entries.map(({ id }) => id);

describe('sameFamilyOf: who is listed', () => {
  it('is undefined for an id the dataset does not have', () => {
    expect(createRelationIndex([trait('a')], taxonomy).sameFamilyOf('b')).toBeUndefined();
  });

  it('names the family of the trait and lists the others of it', () => {
    const traits = [
      trait('focus'),
      trait('sibling'),
      trait('stranger', { family: 'Alemental' }),
      trait('another-stranger', { family: 'Alemental' }),
    ];

    expect(sameFamilyOf(traits, 'focus')).toEqual({ family: 'Abomination', entries: [traits[1]] });
  });

  it('has nobody to list for a trait that is alone in its family, and still names it', () => {
    expect(sameFamilyOf([trait('focus'), trait('stranger', { family: 'Alemental' })], 'focus')).toEqual({
      family: 'Abomination',
      entries: [],
    });
  });

  it('never lists the focus', () => {
    expect(ids(sameFamilyOf([trait('focus'), trait('other')], 'focus'))).toEqual(['other']);
  });

  it('tells families apart exactly: the case of a name is part of it', () => {
    const traits = [trait('focus'), trait('lower', { family: 'abomination' })];

    expect(sameFamilyOf(traits, 'focus').entries).toEqual([]);
  });

  it('gives a mastery the family of its Family column: masteryFamily, not the family of a creature it names', () => {
    const traits = [
      mastery('the-mastery', 'Master of Everything', { masteryFamily: 'Abomination' }),
      trait('creature-of-abomination'),
      trait('creature-of-master', { family: 'Master of Everything' }),
    ];

    expect(sameFamilyOf(traits, 'the-mastery')).toEqual({ family: 'Abomination', entries: [traits[1]] });
    expect(ids(sameFamilyOf(traits, 'creature-of-abomination'))).toEqual(['the-mastery']);
    expect(sameFamilyOf(traits, 'creature-of-master').entries).toEqual([]);
  });
});

describe('sameFamilyOf: the order', () => {
  const ofKind = (id: string, kind: TraitKind, overrides: Partial<Trait> = {}) =>
    trait(id, { kind, ...(kind === 'creature' ? {} : { creature: null }), ...overrides });

  it('puts the mastery first, then creatures, avatars, backers and the other traits', () => {
    const traits = [
      trait('focus'),
      ofKind('other', 'other'),
      ofKind('backer', 'backer'),
      ofKind('avatar', 'avatar'),
      ofKind('creature', 'creature'),
      ofKind('mastery', 'mastery', { masteryFamily: 'Abomination' }),
    ];

    expect(ids(sameFamilyOf(traits, 'focus'))).toEqual(['mastery', 'creature', 'avatar', 'backer', 'other']);
  });

  it('orders the traits of a kind by name regardless of case, then by the exact name, then by id', () => {
    const traits = [
      trait('focus'),
      trait('i1', { name: 'b' }),
      trait('i2', { name: 'a' }),
      trait('i3', { name: 'A' }),
      trait('z-same', { name: 'Same' }),
      trait('a-same', { name: 'Same' }),
      ofKind('first-by-kind', 'mastery', { name: 'Zed', masteryFamily: 'Abomination' }),
    ];

    expect(ids(sameFamilyOf(traits, 'focus'))).toEqual(['first-by-kind', 'i3', 'i2', 'i1', 'a-same', 'z-same']);
  });
});

describe('sameFamilyOf: only artifact-eligible traits', () => {
  const traits = [trait('focus', { material: null }), trait('with-material'), trait('no-material', { material: null })];

  it('keeps every trait by default', () => {
    expect(ids(sameFamilyOf(traits, 'focus'))).toEqual(['no-material', 'with-material']);
    expect(sameFamilyOf(traits, 'focus', { artifactOnly: false })).toEqual(sameFamilyOf(traits, 'focus'));
  });

  it('drops a trait without material, and still reads a focus that has none', () => {
    expect(sameFamilyOf(traits, 'focus', { artifactOnly: true })).toEqual({
      family: 'Abomination',
      entries: [traits[1]],
    });
  });
});

describe('sameFamilyOf: invariants', () => {
  interface TraitShape {
    readonly family: string;
    readonly kind: TraitKind;
    readonly hasMaterial: boolean;
  }
  const shapesArbitrary = fc.array<TraitShape>(
    fc.record({
      family: fc.constantFrom('Abomination', 'Alemental', 'Angel'),
      kind: fc.constantFrom<TraitKind>('creature', 'creature', 'mastery', 'avatar', 'backer', 'other'),
      hasMaterial: fc.boolean(),
    }),
    { maxLength: 16 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ family, kind, hasMaterial }, position) =>
      trait(`t${position}`, {
        family,
        kind,
        creature: kind === 'creature' ? 'Brute' : null,
        masteryFamily: kind === 'mastery' ? family : null,
        material: hasMaterial ? 'Ferrous Ore' : null,
      }),
    );
  const kindRank = (kind: TraitKind) => ['mastery', 'creature', 'avatar', 'backer', 'other'].indexOf(kind);

  it('lists exactly the other traits of the family of the focus, once, and none of any other', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const found = sameFamilyOf(traits, focus.id);
          const expected = traits.filter((other) => other !== focus && other.family === focus.family);

          expect(found.family).toBe(focus.family);
          expect(ids(found).toSorted()).toEqual(expected.map(({ id }) => id).toSorted());
        }
      }),
    );
  });

  it('is ranked by kind, then by name and id', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const focus of traits) {
          const { entries } = sameFamilyOf(traits, focus.id);
          for (const [at, entry] of entries.entries()) {
            const before = entries[at - 1];
            if (before === undefined) continue;
            expect(kindRank(before.kind)).toBeLessThanOrEqual(kindRank(entry.kind));
            if (before.kind === entry.kind) expect(before.id < entry.id).toBe(true);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('is symmetric: A is listed for B exactly when B is listed for A', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        for (const a of traits) {
          for (const b of traits) {
            if (a !== b)
              expect(ids(sameFamilyOf(traits, a.id)).includes(b.id)).toBe(
                ids(sameFamilyOf(traits, b.id)).includes(a.id),
              );
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
              expect(sameFamilyOf(shuffled, focus.id, options)).toEqual(sameFamilyOf(traits, focus.id, options));
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
          expect(sameFamilyOf(traits, focus.id, { artifactOnly: true }).entries).toEqual(
            sameFamilyOf(traits, focus.id).entries.filter(({ material }) => material !== null),
          );
        }
      }),
    );
  });
});
