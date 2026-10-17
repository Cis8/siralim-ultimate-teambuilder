import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  emptyParty,
  filledSlots,
  isEmptyParty,
  MEMBER_INDEXES,
  sameSlot,
  SLOT_NAMES,
  SLOT_POSITIONS,
  traitAt,
  withTraitAt,
  type Party,
  type SlotPosition,
} from './party';

const position = fc.record({
  member: fc.constantFrom(...MEMBER_INDEXES),
  slot: fc.constantFrom(...SLOT_NAMES),
}) satisfies fc.Arbitrary<SlotPosition>;

const traitId = fc.option(fc.constantFrom('abomination--sin-and-sentence', 'master-of-mirelings', 'x--y'), {
  nil: null,
});

/** A party built slot by slot through the only way to write one. */
const party = fc
  .array(fc.tuple(position, traitId), { maxLength: 30 })
  .map((writes) => writes.reduce((built, [at, id]) => withTraitAt(built, at, id), emptyParty));

describe('emptyParty', () => {
  it('has six creatures, each with its three slots empty (GAME_RULES R1)', () => {
    expect(emptyParty).toHaveLength(6);
    for (const member of emptyParty) expect(member).toEqual({ innate: null, fused: null, artifact: null });
  });

  it('has every slot empty', () => {
    for (const member of MEMBER_INDEXES) {
      for (const slot of SLOT_NAMES) expect(traitAt(emptyParty, { member, slot })).toBeNull();
    }
  });
});

describe('isEmptyParty', () => {
  it('is true for the empty party, and for one that was filled and emptied again', () => {
    const emptied = withTraitAt(
      withTraitAt(emptyParty, { member: 3, slot: 'fused' }, 'a--one'),
      { member: 3, slot: 'fused' },
      null,
    );

    expect(isEmptyParty(emptyParty)).toBe(true);
    expect(isEmptyParty(emptied)).toBe(true);
  });

  it('is false when any of the 18 slots holds a trait', () => {
    for (const position of SLOT_POSITIONS) {
      expect(isEmptyParty(withTraitAt(emptyParty, position, 'a--one'))).toBe(false);
    }
  });
});

describe('filledSlots', () => {
  it('is 0 for the empty party', () => {
    expect(filledSlots(emptyParty)).toBe(0);
  });

  it('counts the slots that hold a trait, whichever creature and slot they are', () => {
    const party = [
      { member: 0, slot: 'innate' },
      { member: 0, slot: 'artifact' },
      { member: 5, slot: 'fused' },
    ].reduce<Party>((built, at, index) => withTraitAt(built, at as SlotPosition, `a--${String(index)}`), emptyParty);

    expect(filledSlots(party)).toBe(3);
  });

  it('counts a trait once for every slot it sits in', () => {
    const twice = withTraitAt(
      withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'a--one'),
      { member: 1, slot: 'innate' },
      'a--one',
    );

    expect(filledSlots(twice)).toBe(2);
  });

  it('is 18 for a full party, and goes down by one when a slot is emptied', () => {
    const full = SLOT_POSITIONS.reduce((built, at, index) => withTraitAt(built, at, `a--${String(index)}`), emptyParty);

    expect(filledSlots(full)).toBe(SLOT_POSITIONS.length);
    expect(filledSlots(withTraitAt(full, { member: 2, slot: 'fused' }, null))).toBe(SLOT_POSITIONS.length - 1);
  });
});

describe('sameSlot', () => {
  it('is true for the same creature and slot, even when they are two objects', () => {
    expect(sameSlot({ member: 2, slot: 'fused' }, { member: 2, slot: 'fused' })).toBe(true);
  });

  it('is false when the creature or the slot differs', () => {
    expect(sameSlot({ member: 2, slot: 'fused' }, { member: 3, slot: 'fused' })).toBe(false);
    expect(sameSlot({ member: 2, slot: 'fused' }, { member: 2, slot: 'innate' })).toBe(false);
  });
});

describe('SLOT_POSITIONS', () => {
  it('lists the 18 slots, each once', () => {
    expect(SLOT_POSITIONS).toHaveLength(18);
    expect(new Set(SLOT_POSITIONS.map(({ member, slot }) => `${member}/${slot}`)).size).toBe(18);
  });

  it('reads creature by creature, Innate then Fused then Artifact', () => {
    expect(SLOT_POSITIONS.slice(0, 4)).toEqual([
      { member: 0, slot: 'innate' },
      { member: 0, slot: 'fused' },
      { member: 0, slot: 'artifact' },
      { member: 1, slot: 'innate' },
    ]);
    expect(SLOT_POSITIONS.at(-1)).toEqual({ member: 5, slot: 'artifact' });
  });
});

describe('withTraitAt', () => {
  it('puts the trait in that slot of that creature and in no other', () => {
    const placed = withTraitAt(emptyParty, { member: 2, slot: 'fused' }, 'life--mender');

    expect(placed[2]).toEqual({ innate: null, fused: 'life--mender', artifact: null });
    expect(placed.filter((_, index) => index !== 2)).toEqual(emptyParty.filter((_, index) => index !== 2));
  });

  it('lets the Fused slot be filled before the Innate one, which is never refused (GAME_RULES R1, filling order)', () => {
    const fusedFirst = withTraitAt(emptyParty, { member: 0, slot: 'fused' }, 'life--mender');
    const completed = withTraitAt(fusedFirst, { member: 0, slot: 'innate' }, 'a--one');

    expect(fusedFirst[0]).toEqual({ innate: null, fused: 'life--mender', artifact: null });
    expect(completed[0]).toEqual({ innate: 'a--one', fused: 'life--mender', artifact: null });
  });

  it('replaces what the slot held', () => {
    const first = withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'a--one');

    expect(traitAt(withTraitAt(first, { member: 0, slot: 'innate' }, 'b--two'), { member: 0, slot: 'innate' })).toBe(
      'b--two',
    );
  });

  it('empties a slot when given null', () => {
    const first = withTraitAt(emptyParty, { member: 5, slot: 'artifact' }, 'a--one');

    expect(withTraitAt(first, { member: 5, slot: 'artifact' }, null)).toEqual(emptyParty);
  });

  it('does not touch the party it was given', () => {
    const before: Party = withTraitAt(emptyParty, { member: 1, slot: 'innate' }, 'a--one');
    const snapshot = before.map((member) => ({ ...member }));

    withTraitAt(before, { member: 1, slot: 'innate' }, 'b--two');
    withTraitAt(before, { member: 3, slot: 'artifact' }, 'c--three');

    expect(before).toEqual(snapshot);
  });

  it('keeps the same party when the slot already holds that, so a no-op is told by identity', () => {
    const filled = withTraitAt(emptyParty, { member: 4, slot: 'fused' }, 'a--one');

    expect(withTraitAt(filled, { member: 4, slot: 'fused' }, 'a--one')).toBe(filled);
    expect(withTraitAt(emptyParty, { member: 4, slot: 'fused' }, null)).toBe(emptyParty);
  });

  it('keeps an id nobody knows: a party can come from a dataset that has changed', () => {
    const placed = withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'no-longer--in-the-sheet');

    expect(traitAt(placed, { member: 0, slot: 'innate' })).toBe('no-longer--in-the-sheet');
  });

  it('does not check the slot rules: those need the trait, not its id (see slotRules)', () => {
    expect(() => withTraitAt(emptyParty, { member: 0, slot: 'fused' }, 'rodian-master--anything')).not.toThrow();
  });
});

describe('a write to a party, on any party', () => {
  it('reads back from the slot it was written to', () => {
    fc.assert(
      fc.property(party, position, traitId, (before, at, id) => {
        expect(traitAt(withTraitAt(before, at, id), at)).toBe(id);
      }),
    );
  });

  it('leaves the 17 other slots as they were', () => {
    fc.assert(
      fc.property(party, position, traitId, (before, at, id) => {
        const after = withTraitAt(before, at, id);
        for (const member of MEMBER_INDEXES) {
          for (const slot of SLOT_NAMES) {
            if (member === at.member && slot === at.slot) continue;
            expect(traitAt(after, { member, slot })).toBe(traitAt(before, { member, slot }));
          }
        }
      }),
    );
  });

  it('keeps six creatures', () => {
    fc.assert(
      fc.property(party, position, traitId, (before, at, id) => {
        expect(withTraitAt(before, at, id)).toHaveLength(6);
      }),
    );
  });

  it('is the same party only when nothing changes', () => {
    fc.assert(
      fc.property(party, position, traitId, (before, at, id) => {
        expect(withTraitAt(before, at, id) === before).toBe(traitAt(before, at) === id);
      }),
    );
  });
});
