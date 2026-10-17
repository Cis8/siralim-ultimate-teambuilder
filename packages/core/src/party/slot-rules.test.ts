import { describe, expect, it } from 'vitest';
import type { Trait, TraitKind } from '../model/trait';
import { SLOT_NAMES, type SlotName } from './party';
import { slotRules } from './slot-rules';

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

/** Where a kind of trait may sit (GAME_RULES R1 and R6). `material` means: only if the trait has one. */
type Accepts = 'always' | 'material' | 'never';

// Typed by `TraitKind` and `SlotName`, so that a new kind or slot cannot be left out of the table.
const ACCEPTED: Record<TraitKind, Record<SlotName, Accepts>> = {
  creature: { innate: 'always', fused: 'always', artifact: 'material' },
  avatar: { innate: 'always', fused: 'never', artifact: 'never' },
  mastery: { innate: 'never', fused: 'never', artifact: 'material' },
  backer: { innate: 'never', fused: 'never', artifact: 'material' },
  other: { innate: 'never', fused: 'never', artifact: 'material' },
};

const KINDS = Object.keys(ACCEPTED) as TraitKind[];

describe('slotRules', () => {
  describe.each(KINDS)('a %s trait', (kind) => {
    it.each(SLOT_NAMES)('in the %s slot, with a material', (slot) => {
      const placement = slotRules.canPlace(trait({ kind, material: 'Ferrous Ore' }), slot);

      expect(placement.ok).toBe(ACCEPTED[kind][slot] !== 'never');
    });

    it.each(SLOT_NAMES)('in the %s slot, without a material', (slot) => {
      const placement = slotRules.canPlace(trait({ kind, material: null }), slot);

      expect(placement.ok).toBe(ACCEPTED[kind][slot] === 'always');
    });
  });

  describe('a trait without a material (GAME_RULES R1, acceptance criterion 5)', () => {
    const noMaterial = trait({ material: null });

    it('cannot be placed in the Artifact slot, and says why', () => {
      expect(slotRules.canPlace(noMaterial, 'artifact')).toEqual({
        ok: false,
        rule: 'artifact-needs-material',
        reason: 'This trait has no material, so it cannot go in the Artifact slot.',
      });
    });

    it('can be placed in the Innate and Fused slots: the material matters only to an artifact', () => {
      expect(slotRules.canPlace(noMaterial, 'innate')).toEqual({ ok: true });
      expect(slotRules.canPlace(noMaterial, 'fused')).toEqual({ ok: true });
    });
  });

  describe('a mastery, backer or other special trait (GAME_RULES R6)', () => {
    it.each<[string, Partial<Trait>, string]>([
      ['mastery', { kind: 'mastery', class: 'Rodian Master', creature: null }, 'Mastery'],
      ['backer', { kind: 'backer', class: 'Backer', creature: null }, 'Backer'],
      ['Nether Boss', { kind: 'other', class: 'Nether Boss' }, 'Nether Boss'],
      ['Pandemonium', { kind: 'other', class: 'Pandemonium' }, 'Pandemonium'],
    ])('%s: only fits the Artifact slot, and says so', (_, overrides, name) => {
      for (const slot of ['innate', 'fused'] as const) {
        expect(slotRules.canPlace(trait(overrides), slot)).toEqual({
          ok: false,
          rule: 'special-traits-artifact-only',
          reason: `${name} traits can only go in the Artifact slot.`,
        });
      }
      expect(slotRules.canPlace(trait(overrides), 'artifact')).toEqual({ ok: true });
    });
  });

  describe('an Avatar trait (GAME_RULES R6)', () => {
    const avatar = trait({ kind: 'avatar', family: 'Avatar', material: null });

    it('only fits the Innate slot: an Avatar cannot be the second creature of a fusion', () => {
      expect(slotRules.canPlace(avatar, 'innate')).toEqual({ ok: true });
      for (const slot of ['fused', 'artifact'] as const) {
        expect(slotRules.canPlace(avatar, slot)).toEqual({
          ok: false,
          rule: 'avatar-innate-only',
          reason: 'Avatar traits can only go in the Innate slot.',
        });
      }
    });

    it('is refused as an artifact for being an Avatar even if it had a material, which R6 puts first', () => {
      expect(slotRules.canPlace({ ...avatar, material: 'Ferrous Ore' }, 'artifact')).toMatchObject({
        ok: false,
        rule: 'avatar-innate-only',
      });
    });
  });

  it('gives the reason of the rule about the kind before the one about the material', () => {
    const masteryWithoutMaterial = trait({ kind: 'mastery', class: 'Rodian Master', creature: null, material: null });

    expect(slotRules.canPlace(masteryWithoutMaterial, 'innate')).toMatchObject({
      rule: 'special-traits-artifact-only',
    });
    expect(slotRules.canPlace(masteryWithoutMaterial, 'artifact')).toMatchObject({ rule: 'artifact-needs-material' });
  });

  it('knows its rules by id, each once', () => {
    expect(slotRules.rules.map(({ id }) => id)).toEqual([
      'special-traits-artifact-only',
      'avatar-innate-only',
      'artifact-needs-material',
    ]);
  });
});
