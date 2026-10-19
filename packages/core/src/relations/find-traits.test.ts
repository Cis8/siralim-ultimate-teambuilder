import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { findTraits } from './find-traits';

function trait(name: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id: name.toLowerCase().replaceAll(' ', '-'),
    name,
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

const names = (found: readonly Trait[]) => found.map(({ name }) => name);

describe('findTraits: by name', () => {
  const traits = [
    trait('Sin and Sentence'),
    trait('Original Sin'),
    trait('Cousin Itt'),
    trait('Mother’s Wrath'),
    trait('Sinister Plot'),
  ];

  it('lists first the names that begin with what was typed, then those with a word that does, then the rest', () => {
    expect(names(findTraits(traits, 'sin', 10))).toEqual([
      'Sin and Sentence',
      'Sinister Plot',
      'Original Sin',
      'Cousin Itt',
    ]);
  });

  it('puts names that fit alike in the order of a list a reader looks through', () => {
    expect(names(findTraits([trait('Zeal'), trait('zero'), trait('Zap')], 'z', 10))).toEqual(['Zap', 'Zeal', 'zero']);
  });

  it('ignores the case of what was typed and of the name', () => {
    expect(names(findTraits(traits, 'MOTHER’S', 10))).toEqual(['Mother’s Wrath']);
  });

  it('ignores the blanks around what was typed, but not the ones inside', () => {
    expect(names(findTraits(traits, '  sin and ', 10))).toEqual(['Sin and Sentence']);
    expect(findTraits(traits, 'sinand', 10)).toEqual([]);
  });

  it('lists nothing for nothing typed: the picker shows its own invitation', () => {
    expect(findTraits(traits, '', 10)).toEqual([]);
    expect(findTraits(traits, '   ', 10)).toEqual([]);
  });

  it('lists nothing for a text no trait has', () => {
    expect(findTraits(traits, 'xyzzy', 10)).toEqual([]);
  });
});

describe('findTraits: by creature or family', () => {
  const traits = [
    trait('Pyre', { creature: 'Demon Imp', family: 'Hellfire', class: 'Chaos' }),
    trait('Dread Choir', { creature: 'Abomination Singer', family: 'Abomination' }),
    trait('Hellfire Brand', { creature: 'Demon Imp', family: 'Hellfire' }),
    trait('Mastery of Pyres', { creature: null, family: 'Hellfire', masteryFamily: 'Hellfire', kind: 'mastery' }),
  ];

  it('finds the traits of a creature or a family by what was typed of it', () => {
    expect(names(findTraits(traits, 'demon', 10))).toEqual(['Hellfire Brand', 'Pyre']);
    expect(names(findTraits(traits, 'abomin', 10))).toEqual(['Dread Choir']);
  });

  it('finds the traits of the family of a mastery, which has no creature', () => {
    expect(names(findTraits(traits, 'hellfire', 10))).toEqual(['Hellfire Brand', 'Mastery of Pyres', 'Pyre']);
  });

  // The family the Same family section lists the trait under (GAME_RULES R3), so the picker and that section agree.
  it('reads the family of a mastery as its mastery family, not its family column', () => {
    const mastery = trait('Rite', { creature: null, family: 'Elsewhere', masteryFamily: 'Hellfire', kind: 'mastery' });

    expect(names(findTraits([mastery], 'hellfire', 10))).toEqual(['Rite']);
    expect(findTraits([mastery], 'elsewhere', 10)).toEqual([]);
  });

  it('puts a trait whose name fits before one whose creature or family does', () => {
    expect(names(findTraits(traits, 'hell', 10))[0]).toBe('Hellfire Brand');
  });

  it('puts a name that begins with the text before one with a word that does, and both before a creature or family', () => {
    const found = findTraits(
      [
        trait('Pillar of Imp', { creature: 'Imp Pillar', family: 'Imp' }),
        trait('Other', { creature: 'Imp Pillar', family: 'Imp' }),
        trait('Imp Cry', { creature: 'Bird', family: 'Songbird' }),
      ],
      'imp',
      10,
    );

    expect(names(found)).toEqual(['Imp Cry', 'Pillar of Imp', 'Other']);
  });

  it('does not count a trait twice for fitting by name and by family', () => {
    const found = findTraits([trait('Hellfire', { family: 'Hellfire' })], 'hell', 10);

    expect(found).toHaveLength(1);
  });
});

describe('findTraits: the limit', () => {
  const traits = Array.from({ length: 12 }, (_, at) => trait(`Brute ${String(at + 10)}`));

  it('lists at most the number asked, the best fits', () => {
    expect(names(findTraits(traits, 'brute', 3))).toEqual(['Brute 10', 'Brute 11', 'Brute 12']);
  });

  it('lists nothing for a limit of none', () => {
    expect(findTraits(traits, 'brute', 0)).toEqual([]);
    expect(findTraits(traits, 'brute', -4)).toEqual([]);
  });

  it('lists every trait found when there are fewer than the limit', () => {
    expect(findTraits(traits, 'brute 1', 100)).toHaveLength(10);
  });
});

describe('findTraits: properties', () => {
  const traitsArbitrary = fc
    .array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 10 }),
        family: fc.constantFrom('Abomination', 'Hellfire', 'Gnome'),
        creature: fc.constantFrom('Imp', 'Gnome Mage', null),
      }),
      { maxLength: 30 },
    )
    .map((list) => list.map((fields, at) => trait(fields.name, { ...fields, id: `t${String(at)}` })));

  it('lists only traits that have the text in their name, creature or family', () => {
    fc.assert(
      fc.property(traitsArbitrary, fc.constantFrom('a', 'ab', 'imp', 'GNOME', 'e '), (traits, typed) => {
        const wanted = typed.trim().toLowerCase();
        for (const found of findTraits(traits, typed, 50)) {
          const texts = [found.name, found.family, found.creature ?? ''];
          expect(texts.some((text) => text.toLowerCase().includes(wanted))).toBe(true);
        }
      }),
    );
  });

  it('lists each trait at most once, and in the same order whatever order the traits were given in', () => {
    fc.assert(
      fc.property(traitsArbitrary, fc.constantFrom('a', 'imp', 'gnome'), (traits, typed) => {
        const found = findTraits(traits, typed, 50);

        expect(new Set(found.map(({ id }) => id)).size).toBe(found.length);
        expect(found.map(({ id }) => id)).toEqual(findTraits(traits.toReversed(), typed, 50).map(({ id }) => id));
      }),
    );
  });
});
