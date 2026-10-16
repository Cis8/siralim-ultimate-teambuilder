import { describe, expect, it } from 'vitest';
import type { IdentifiedTraitRow } from '../model/trait';
import { enrichTraits } from './enrich-traits';

function row(overrides: Partial<IdentifiedTraitRow> = {}): IdentifiedTraitRow {
  return {
    id: 'abomination--flesh-rot',
    class: 'Death',
    family: 'Abomination',
    creature: 'Abomination Brute',
    name: 'Flesh Rot',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    ...overrides,
  };
}

const masteryRow = (family: string, description: string) =>
  row({
    id: `${family.toLowerCase()}--master-of-${family.toLowerCase()}s`,
    class: 'Rodian Master',
    family,
    creature: 'Mastery Trait',
    name: `Master of ${family}s`,
    description,
    material: `Sigil of the ${family}`,
  });

describe('enrichTraits', () => {
  it('returns nothing for no rows', () => {
    expect(enrichTraits([])).toEqual([]);
  });

  it('turns a plain creature trait into a trait with its derived fields', () => {
    expect(enrichTraits([row()])).toEqual([
      {
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
      },
    ]);
  });

  it('keeps the order of the rows', () => {
    const names = enrichTraits([row({ name: 'B' }), row({ name: 'A' }), row({ name: 'C' })]).map((t) => t.name);
    expect(names).toEqual(['B', 'A', 'C']);
  });

  it('reads "This trait does not stack." as not stacking', () => {
    const [trait] = enrichTraits([row({ description: 'Deals damage. This trait does not stack.' })]);
    expect(trait?.stacks).toBe(false);
  });

  it('detects a random debuff', () => {
    const [trait] = enrichTraits([row({ description: 'This creature afflicts enemies with a random debuff.' })]);
    expect(trait?.randomDebuff).toEqual({ target: 'enemy', activation: 'unconditional' });
  });

  it('keeps an Avatar as an avatar, with its creature', () => {
    const [trait] = enrichTraits([row({ class: 'Chaos', family: 'Avatar', creature: 'Caliban' })]);
    expect(trait).toMatchObject({ kind: 'avatar', creature: 'Caliban' });
  });

  it('gives a trait of another class the other kind', () => {
    const [trait] = enrichTraits([row({ class: 'Nether Boss', family: 'Maniac', creature: 'Loid' })]);
    expect(trait).toMatchObject({ kind: 'other', creature: 'Loid' });
  });

  describe('masteries', () => {
    const rows = [
      row({ family: 'Hound', name: 'Bark', creature: 'Hound Pup' }),
      row({ family: 'Wolf', name: 'Howl', creature: 'Wolf Pup' }),
      masteryRow('Hound', "Your Hounds' Wolves now deal damage based on their highest stat."),
      masteryRow('Wolf', 'If all the creatures in your party are Wolves, they deal 10% more damage.'),
    ];
    const [, , hound, wolf] = enrichTraits(rows);

    it('has no creature', () => {
      expect(hound?.creature).toBeNull();
    });

    it('takes the family from the Family column', () => {
      expect(hound).toMatchObject({ kind: 'mastery', family: 'Hound', masteryFamily: 'Hound' });
    });

    it('reads the party requirement against the families of the whole sheet', () => {
      expect(wolf?.partyRequirement).toEqual({ type: 'allFamily', families: ['Wolf'] });
      expect(hound?.partyRequirement).toEqual({ type: 'familyScoped', families: ['Hound'] });
    });
  });

  describe('backer traits', () => {
    const [backer] = enrichTraits([
      row({
        class: 'Backer',
        family: 'Backer',
        creature: 'Backer Trait',
        name: 'Glitch In The System',
        description: 'When a creature would gain a buff, it is afflicted with a random debuff instead.',
      }),
    ]);

    it('has no creature and no mastery fields', () => {
      expect(backer).toMatchObject({
        kind: 'backer',
        creature: null,
        masteryFamily: null,
        partyRequirement: null,
      });
    });

    it('still gets the fields every trait gets', () => {
      expect(backer?.randomDebuff).toEqual({ target: 'both', activation: 'unconditional' });
    });
  });

  it('starts with no keywords: extracting them is a later stage', () => {
    expect(enrichTraits([row()])[0]?.keywords).toEqual([]);
  });
});
