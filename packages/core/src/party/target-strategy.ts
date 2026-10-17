import { sameSlot, SLOT_POSITIONS, traitAt, type Party, type SlotPosition } from './party';

/**
 * Where the next trait goes, given the party and the slot that was the target until now (the one just filled, or just
 * left). A strategy only reads: it does not place anything.
 */
export type TargetStrategy = (party: Party, from: SlotPosition) => SlotPosition;

/** Where the target is when nobody has chosen one: the first empty slot, or the very first when the party is full. */
export function firstEmptySlot(party: Party): SlotPosition {
  return SLOT_POSITIONS.find((at) => traitAt(party, at) === null) ?? { member: 0, slot: 'innate' };
}

/**
 * The first empty slot after `from` in reading order, going round to the beginning after the last one: filling a party
 * from the top is then a matter of adding trait after trait. When no other slot is empty it stays on `from`.
 */
export const nextEmptySlot: TargetStrategy = (party, from) => {
  const start = SLOT_POSITIONS.findIndex((at) => sameSlot(at, from));
  for (let step = 1; step < SLOT_POSITIONS.length; step++) {
    const candidate = SLOT_POSITIONS[(start + step) % SLOT_POSITIONS.length];
    if (candidate !== undefined && traitAt(party, candidate) === null) return candidate;
  }
  return from;
};
