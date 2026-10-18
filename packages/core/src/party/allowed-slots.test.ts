import { describe, expect, it } from 'vitest';
import type { Trait, TraitKind } from '../model/trait';
import { allowedSlots } from './allowed-slots';
import { SLOT_NAMES, type SlotName } from './party';
import { createSlotRuleRegistry } from './slot-rule-registry';

function trait(overrides: Partial<Trait> = {}): Trait {
  return {
    id: 'abomination--sin-and-sentence',
    name: 'Sin and Sentence',
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

describe('allowedSlots (GAME_RULES R1, R6)', () => {
  // The table of R1, once per kind: with a material and without one.
  const TABLE: readonly [TraitKind, boolean, readonly SlotName[]][] = [
    ['creature', true, ['innate', 'fused', 'artifact']],
    ['creature', false, ['innate', 'fused']],
    ['avatar', true, ['innate']],
    ['avatar', false, ['innate']],
    ['mastery', true, ['artifact']],
    ['mastery', false, []],
    ['backer', true, ['artifact']],
    ['backer', false, []],
    ['other', true, ['artifact']],
    ['other', false, []],
  ];

  it.each(TABLE)('a %s trait, with a material: %s, goes in %j', (kind, hasMaterial, slots) => {
    expect(allowedSlots(trait({ kind, material: hasMaterial ? 'Ferrous Ore' : null }))).toEqual(slots);
  });

  it('names the slots in the order of a creature: Innate, Fused, Artifact', () => {
    const slots = allowedSlots(trait());

    expect(slots).toEqual(SLOT_NAMES.filter((slot) => slots.includes(slot)));
  });

  it('asks the rules it is given: a game with another rule has other slots', () => {
    const noFused = createSlotRuleRegistry([
      { id: 'no-fused', refusal: (_, slot) => (slot === 'fused' ? 'No.' : null) },
    ]);

    expect(allowedSlots(trait(), noFused)).toEqual(['innate', 'artifact']);
  });

  it('is every slot when there are no rules at all', () => {
    expect(allowedSlots(trait({ kind: 'mastery', material: null }), createSlotRuleRegistry([]))).toEqual(SLOT_NAMES);
  });

  it('is empty when the rules refuse the trait everywhere', () => {
    const nothing = createSlotRuleRegistry([{ id: 'nothing', refusal: () => 'No.' }]);

    expect(allowedSlots(trait(), nothing)).toEqual([]);
  });
});
