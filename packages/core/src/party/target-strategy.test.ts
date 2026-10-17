import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { emptyParty, SLOT_POSITIONS, traitAt, withTraitAt, type Party, type SlotPosition } from './party';
import { firstEmptySlot, nextEmptySlot } from './target-strategy';

/** A party with a trait in each of the given slots. */
function filled(positions: readonly SlotPosition[]): Party {
  return positions.reduce((party, at) => withTraitAt(party, at, 'a--one'), emptyParty);
}

const FULL = filled(SLOT_POSITIONS);

/** Where a slot stands in the reading order, 0 to 17. */
function indexOf(at: SlotPosition): number {
  return SLOT_POSITIONS.findIndex(({ member, slot }) => member === at.member && slot === at.slot);
}

describe('firstEmptySlot', () => {
  it('is the Innate slot of the first creature when the party is empty', () => {
    expect(firstEmptySlot(emptyParty)).toEqual({ member: 0, slot: 'innate' });
  });

  it('is the first slot, in reading order, that holds nothing', () => {
    const party = filled([
      { member: 0, slot: 'innate' },
      { member: 0, slot: 'fused' },
      { member: 1, slot: 'fused' },
    ]);

    expect(firstEmptySlot(party)).toEqual({ member: 0, slot: 'artifact' });
  });

  it('is the first slot of all when the party is full', () => {
    expect(firstEmptySlot(FULL)).toEqual({ member: 0, slot: 'innate' });
  });
});

describe('nextEmptySlot', () => {
  it('is the slot after the one just filled, in reading order: Innate, Fused, Artifact, then the next creature', () => {
    expect(nextEmptySlot(emptyParty, { member: 0, slot: 'innate' })).toEqual({ member: 0, slot: 'fused' });
    expect(nextEmptySlot(emptyParty, { member: 0, slot: 'fused' })).toEqual({ member: 0, slot: 'artifact' });
    expect(nextEmptySlot(emptyParty, { member: 0, slot: 'artifact' })).toEqual({ member: 1, slot: 'innate' });
  });

  it('skips the slots that are filled', () => {
    const party = filled([
      { member: 0, slot: 'innate' },
      { member: 0, slot: 'fused' },
      { member: 1, slot: 'innate' },
    ]);

    expect(nextEmptySlot(party, { member: 0, slot: 'innate' })).toEqual({ member: 0, slot: 'artifact' });
    expect(nextEmptySlot(party, { member: 0, slot: 'artifact' })).toEqual({ member: 1, slot: 'fused' });
  });

  it('goes round to the beginning after the last slot', () => {
    const party = filled([{ member: 0, slot: 'innate' }]);

    expect(nextEmptySlot(party, { member: 5, slot: 'artifact' })).toEqual({ member: 0, slot: 'fused' });
  });

  it('finds an empty slot behind the one just filled, when everything after it is filled', () => {
    const party = filled(SLOT_POSITIONS.filter(({ member, slot }) => !(member === 2 && slot === 'fused')));

    expect(nextEmptySlot(party, { member: 4, slot: 'innate' })).toEqual({ member: 2, slot: 'fused' });
  });

  it('stays where it is when the party is full', () => {
    expect(nextEmptySlot(FULL, { member: 3, slot: 'fused' })).toEqual({ member: 3, slot: 'fused' });
  });

  it('stays where it is when that is the only empty slot', () => {
    const party = filled(SLOT_POSITIONS.filter(({ member, slot }) => !(member === 3 && slot === 'fused')));

    expect(nextEmptySlot(party, { member: 3, slot: 'fused' })).toEqual({ member: 3, slot: 'fused' });
  });

  it('does not change the party', () => {
    const party = filled([{ member: 0, slot: 'innate' }]);

    nextEmptySlot(party, { member: 0, slot: 'innate' });

    expect(party).toEqual(filled([{ member: 0, slot: 'innate' }]));
  });

  describe('on any party and any starting slot', () => {
    const scenario = fc.tuple(fc.subarray([...SLOT_POSITIONS]), fc.constantFrom(...SLOT_POSITIONS));

    it('lands on an empty slot other than the starting one whenever there is one', () => {
      fc.assert(
        fc.property(scenario, ([positions, from]) => {
          const party = filled(positions);
          const hasOtherEmpty = SLOT_POSITIONS.some(
            (at) => indexOf(at) !== indexOf(from) && traitAt(party, at) === null,
          );

          const target = nextEmptySlot(party, from);

          if (hasOtherEmpty) {
            expect(traitAt(party, target)).toBeNull();
            expect(indexOf(target)).not.toBe(indexOf(from));
          } else {
            expect(target).toEqual(from);
          }
        }),
      );
    });

    it('lands on the first empty slot after the starting one, going round', () => {
      fc.assert(
        fc.property(scenario, ([positions, from]) => {
          const party = filled(positions);

          const target = nextEmptySlot(party, from);

          const stepsToTarget = (indexOf(target) - indexOf(from) + 18) % 18;
          for (let step = 1; step < stepsToTarget; step++) {
            const between = SLOT_POSITIONS[(indexOf(from) + step) % 18];
            expect(between !== undefined && traitAt(party, between) !== null).toBe(true);
          }
        }),
      );
    });
  });
});
