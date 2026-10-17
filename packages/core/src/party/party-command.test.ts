import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { applyCommand } from './party-command';
import { emptyParty, traitAt, withTraitAt, type Party, type SlotPosition } from './party';
import { createSlotRuleRegistry } from './slot-rule-registry';

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

const innateOfFirst: SlotPosition = { member: 0, slot: 'innate' };
const fusedOfThird: SlotPosition = { member: 2, slot: 'fused' };

/** The party a command is applied to, for the cases where it must not be empty. */
function partyWithTwoTraits(): Party {
  return withTraitAt(withTraitAt(emptyParty, innateOfFirst, 'a--one'), fusedOfThird, 'b--two');
}

describe('applyCommand: place-trait', () => {
  it('puts the trait in the slot', () => {
    const result = applyCommand(emptyParty, { type: 'place-trait', at: fusedOfThird, trait: trait('life--mender') });

    expect(result).toEqual({ ok: true, party: withTraitAt(emptyParty, fusedOfThird, 'life--mender') });
  });

  it('replaces the trait the slot held', () => {
    const result = applyCommand(partyWithTwoTraits(), {
      type: 'place-trait',
      at: innateOfFirst,
      trait: trait('c--three'),
    });

    expect(result.ok && traitAt(result.party, innateOfFirst)).toBe('c--three');
    expect(result.ok && traitAt(result.party, fusedOfThird)).toBe('b--two');
  });

  it('gives the very same party when the slot already holds the trait', () => {
    const party = partyWithTwoTraits();

    const result = applyCommand(party, { type: 'place-trait', at: innateOfFirst, trait: trait('a--one') });

    expect(result).toEqual({ ok: true, party });
    expect(result.ok && result.party).toBe(party);
  });

  describe('a trait the slot rules refuse (acceptance criterion 5)', () => {
    const mastery = trait('master-of-mirelings', { kind: 'mastery' });

    it('is an error with the rule and the reason, and the party is not touched', () => {
      const party = partyWithTwoTraits();

      const result = applyCommand(party, { type: 'place-trait', at: innateOfFirst, trait: mastery });

      expect(result).toEqual({
        ok: false,
        rule: 'special-traits-artifact-only',
        reason: 'Mastery traits can only go in the Artifact slot.',
      });
      expect(party).toEqual(partyWithTwoTraits());
    });

    it('is refused even when the slot already holds it: the rules come first', () => {
      const party = withTraitAt(emptyParty, innateOfFirst, mastery.id);

      const result = applyCommand(party, { type: 'place-trait', at: innateOfFirst, trait: mastery });

      expect(result.ok).toBe(false);
    });

    it('asks the registry it is given, so a new rule of the game is a new entry', () => {
      const refuseEverything = createSlotRuleRegistry([{ id: 'closed', refusal: () => 'The slot is closed.' }]);
      const acceptEverything = createSlotRuleRegistry([]);

      expect(
        applyCommand(emptyParty, { type: 'place-trait', at: fusedOfThird, trait: trait('x--y') }, refuseEverything),
      ).toEqual({ ok: false, rule: 'closed', reason: 'The slot is closed.' });
      expect(
        applyCommand(emptyParty, { type: 'place-trait', at: innateOfFirst, trait: mastery }, acceptEverything).ok,
      ).toBe(true);
    });
  });
});

describe('applyCommand: clear-slot', () => {
  it('empties the slot and no other', () => {
    const result = applyCommand(partyWithTwoTraits(), { type: 'clear-slot', at: innateOfFirst });

    expect(result).toEqual({ ok: true, party: withTraitAt(emptyParty, fusedOfThird, 'b--two') });
  });

  it('gives the very same party when the slot is already empty', () => {
    const party = partyWithTwoTraits();

    const result = applyCommand(party, { type: 'clear-slot', at: { member: 5, slot: 'artifact' } });

    expect(result.ok && result.party).toBe(party);
  });
});

describe('applyCommand: clear-party', () => {
  it('empties all 18 slots', () => {
    const result = applyCommand(partyWithTwoTraits(), { type: 'clear-party' });

    expect(result).toEqual({ ok: true, party: emptyParty });
  });

  it('gives the very same party when it is empty already, whichever way it got empty', () => {
    const filledThenEmptied = withTraitAt(withTraitAt(emptyParty, innateOfFirst, 'a--one'), innateOfFirst, null);

    const result = applyCommand(filledThenEmptied, { type: 'clear-party' });

    expect(result.ok && result.party).toBe(filledThenEmptied);
  });
});
