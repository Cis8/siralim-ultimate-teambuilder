import type { SlotPosition, Trait } from '@atlas/core';
import { describe, expect, it, vi } from 'vitest';
import { addControl, pressAdd } from './party-add';
import type { Focusable, PartyActions } from './party-actions';

const trait = { id: 'family--mender', name: 'Mender' } as Trait;
const innate: SlotPosition = { member: 0, slot: 'innate' };
const fused: SlotPosition = { member: 1, slot: 'fused' };

/** A party that records what it is asked to do, so that a test reads the spies and not the methods of the object. */
function setup(overrides: Partial<PartyActions> = {}) {
  const add = vi.fn();
  const chooseSlot = vi.fn();
  const actions: PartyActions = {
    target: innate,
    refusal: () => null,
    add,
    canChooseSlot: () => false,
    chooseSlot,
    placesOf: () => [],
    ...overrides,
  };
  return { actions, add, chooseSlot };
}

const party = (overrides: Partial<PartyActions> = {}): PartyActions => setup(overrides).actions;

const opener: Focusable = { isConnected: true, focus: vi.fn() };

describe('addControl', () => {
  it('adds to the target slot when it takes the trait, and says which slot and which trait', () => {
    const control = addControl(trait, party({ target: fused }));

    expect(control).toMatchObject({
      refusal: null,
      chooses: false,
      label: 'Add to Creature 2 · Fused',
      name: 'Add to Creature 2 · Fused — Mender',
    });
  });

  it('offers a choice of slot when the target refuses and another slot of the creature takes the trait', () => {
    const control = addControl(
      trait,
      party({ refusal: () => 'Only in the Artifact slot.', canChooseSlot: () => true }),
    );

    expect(control).toMatchObject({
      refusal: 'Only in the Artifact slot.',
      chooses: true,
      label: 'Add to…',
      name: 'Add to… — Mender',
    });
  });

  it('only gives the reason when no slot takes the trait: the button stays what it was and the press says why', () => {
    const control = addControl(trait, party({ refusal: () => 'No slot takes it.', canChooseSlot: () => false }));

    expect(control).toMatchObject({
      refusal: 'No slot takes it.',
      chooses: false,
      label: 'Add to Creature 1 · Innate',
    });
  });

  it('never offers a choice for a trait the target takes, whatever else could take it', () => {
    expect(addControl(trait, party({ canChooseSlot: () => true })).chooses).toBe(false);
  });

  it('lists where the party holds the trait', () => {
    expect(addControl(trait, party({ placesOf: () => [innate, fused] })).places).toEqual([innate, fused]);
  });
});

describe('pressAdd', () => {
  it('puts the trait in the target slot', () => {
    const { actions, add, chooseSlot } = setup();

    pressAdd(trait, actions, opener);

    expect(add).toHaveBeenCalledWith(trait);
    expect(chooseSlot).not.toHaveBeenCalled();
  });

  it('opens the choice of slot, giving the button that opened it for the focus to come back to', () => {
    const { actions, add, chooseSlot } = setup({ refusal: () => 'No.', canChooseSlot: () => true });

    pressAdd(trait, actions, opener);

    expect(chooseSlot).toHaveBeenCalledWith(trait, opener);
    expect(add).not.toHaveBeenCalled();
  });

  it('asks the party to add a trait the target refuses and no slot takes: the party announces the reason', () => {
    const { actions, add } = setup({ refusal: () => 'No.', canChooseSlot: () => false });

    pressAdd(trait, actions, opener);

    expect(add).toHaveBeenCalledWith(trait);
  });
});
