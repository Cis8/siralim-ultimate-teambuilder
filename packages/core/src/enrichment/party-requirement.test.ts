import { describe, expect, it } from 'vitest';
import type { PartyRequirement } from '../model/trait';
import { createFamilyMatcher } from './family-matcher';
import { parsePartyRequirement } from './party-requirement';

const matcher = createFamilyMatcher([
  'Abomination',
  'Angel',
  'Animation',
  'Apocalypse',
  'Arachnalisk',
  'Cruncher',
  'Diabolic Horde',
  'Effigy',
  'Familiar',
  'Godspawn',
  'Hound',
  'Imler',
  'Imling',
  'Lucanian',
  'Mireling',
  'Sanctus',
  'Sea Shambler',
  'Sin',
  'Smith',
  'Wolf',
]);

const parse = (description: string): PartyRequirement => parsePartyRequirement(description, matcher);

// Texts are quoted from compendium v2.0.
describe('parsePartyRequirement (GAME_RULES R3)', () => {
  describe('allFamily', () => {
    it.each([
      [
        'If all the creatures in your party are Abominations, enemies always have Weak and Vulnerable, and take 50% more damage. This trait does not stack.',
        'Abomination',
      ],
      [
        'If all the creatures in your party are Effigy creatures, they always have Cursed, Burning, Poisoned, and Bleeding and take 75% less damage from these debuffs.',
        'Effigy',
      ],
      [
        "If all the creatures in your party belong to the Godspawn race, at the start of battle, your Godspawn creatures gain their respective Avatar's trait.",
        'Godspawn',
      ],
      [
        'After all start-of-battle effects occur, if all the creatures in your party are Lucanians, their Attack and Intelligence are set equal to whichever is highest.',
        'Lucanian',
      ],
      [
        "At the start of battle, if all the creatures in your party are Smiths, they share their Artifact's trait with the creature to the left.",
        'Smith',
      ],
    ])('reads %j', (description, family) => {
      expect(parse(description)).toEqual({ type: 'allFamily', families: [family] });
    });

    it('wins over a "for each" in the effect', () => {
      expect(
        parse(
          'If all the creatures in your party are Crunchers, they deal 10% more damage for each Sealed enemy Spell Gem. This trait does not stack.',
        ),
      ).toEqual({ type: 'allFamily', families: ['Cruncher'] });
      expect(
        parse(
          'If all the creatures in your party are Sea Shamblers, they take 12% less damage for each enemy that is afflicted with Blighted. This trait does not stack.',
        ),
      ).toEqual({ type: 'allFamily', families: ['Sea Shambler'] });
    });

    it('only looks at the families named in the condition, not in the effect', () => {
      expect(parse('If all the creatures in your party are Angels, your Abominations deal 10% more damage.')).toEqual({
        type: 'allFamily',
        families: ['Angel'],
      });
    });

    it('keeps the type when the family is not one it knows', () => {
      expect(parse('If all the creatures in your party are Dodos, they dodge.')).toEqual({
        type: 'allFamily',
        families: [],
      });
    });
  });

  describe('distinctFamilyCount', () => {
    it('reads the count and the family', () => {
      expect(
        parse(
          'If you have 6 different Sanctuses in your party, they gain 3 random Sin traits at the start of battle. This trait does not stack.',
        ),
      ).toEqual({ type: 'distinctFamilyCount', families: ['Sanctus'], count: 6 });
    });

    it('does not mistake the family of the effect for the one of the condition', () => {
      expect(
        parse(
          'If you have 6 different Sins in your party, they gain 3 random Sanctus traits at the start of battle. This trait does not stack.',
        ),
      ).toEqual({ type: 'distinctFamilyCount', families: ['Sin'], count: 6 });
    });
  });

  describe('perFamilyCount', () => {
    it('reads the family after "for each"', () => {
      expect(
        parse(
          'Enemies take 20% more damage from Poisoned for each Arachnalisk fighting on your side. This trait does not stack.',
        ),
      ).toEqual({ type: 'perFamilyCount', families: ['Arachnalisk'] });
    });

    it('reads several families', () => {
      expect(
        parse(
          'Your Imlers and Imlings deal 20% more damage for each Imler and Imling fighting on your side. This trait does not stack.',
        ),
      ).toEqual({ type: 'perFamilyCount', families: ['Imler', 'Imling'] });
    });

    it('also reads "in your party"', () => {
      expect(parse('Your creatures deal 5% more damage for each Angel in your party.')).toEqual({
        type: 'perFamilyCount',
        families: ['Angel'],
      });
    });
  });

  describe('classDiversity', () => {
    it('reads the Master of Mirelings', () => {
      expect(
        parse(
          "Enemies have 5% less stats for each different class of creatures fighting on your side. If you have a creature from each class, your Mirelings' traits act as if they have 1 additional unique class. This trait does not stack.",
        ),
      ).toEqual({ type: 'classDiversity' });
    });
  });

  describe('familyScoped', () => {
    it.each([
      ["Your Angels' attacks apply all the debuffs that your other Angels' innate traits apply as well.", ['Angel']],
      ['Your Apocalypses act as if they take 1 additional turn. This trait does not stack.', ['Apocalypse']],
      [
        'Your Animation creatures have a 50% chance to receive all effects that require them to be adjacent to your other creatures. This trait does not stack.',
        ['Animation'],
      ],
    ])('reads the family a "your X" effect targets: %j', (description, families) => {
      expect(parse(description)).toEqual({ type: 'familyScoped', families });
    });

    it('is not fooled by "for each time"', () => {
      expect(
        parse(
          'Your Familiars have 10% more Intelligence for each time your Familiars have cast a spell in the current battle. This trait does not stack.',
        ),
      ).toEqual({ type: 'familyScoped', families: ['Familiar'] });
    });

    it('only counts families the party owns ("your X"), not any family named', () => {
      expect(parse("Your Hounds' Dire Wolves now deal damage based on their highest stat rather than Speed.")).toEqual({
        type: 'familyScoped',
        families: ['Hound'],
      });
    });
  });

  describe('none', () => {
    it('is for an effect that names no family of the party', () => {
      expect(parse("At the start of battle, your creatures' races are changed to Diabolic Horde.")).toEqual({
        type: 'none',
      });
    });

    it('is also what an empty text gives', () => {
      expect(parse('')).toEqual({ type: 'none' });
    });
  });
});
