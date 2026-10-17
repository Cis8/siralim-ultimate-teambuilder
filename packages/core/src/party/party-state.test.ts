import { describe, expect, it } from 'vitest';
import { emptyParty, withTraitAt, type SlotPosition } from './party';
import { initialPartyState, samePartyState } from './party-state';

const first: SlotPosition = { member: 0, slot: 'innate' };
const filled = withTraitAt(emptyParty, first, 'a--one');

describe('initialPartyState', () => {
  it('is an empty party with the target on its first slot', () => {
    expect(initialPartyState.party).toBe(emptyParty);
    expect(initialPartyState.target).toEqual({ member: 0, slot: 'innate' });
  });
});

describe('samePartyState', () => {
  it('is true for the same slots and target, even when they are other objects', () => {
    const again = withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'a--one');

    expect(samePartyState({ party: filled, target: first }, { party: again, target: { ...first } })).toBe(true);
  });

  it('is false when a slot holds another trait, or none', () => {
    const other = withTraitAt(emptyParty, first, 'b--two');

    expect(samePartyState({ party: filled, target: first }, { party: other, target: first })).toBe(false);
    expect(samePartyState({ party: filled, target: first }, { party: emptyParty, target: first })).toBe(false);
  });

  it('is false when the target differs', () => {
    expect(
      samePartyState({ party: filled, target: first }, { party: filled, target: { member: 0, slot: 'fused' } }),
    ).toBe(false);
  });
});
