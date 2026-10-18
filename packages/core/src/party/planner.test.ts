import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { canRedo, canUndo } from './party-history';
import { emptyParty, SLOT_POSITIONS, traitAt, withTraitAt, type SlotPosition } from './party';
import {
  addTrait,
  addTraitAt,
  chooseTarget,
  clearParty,
  clearSlot,
  createPlanner,
  redoEdit,
  undoEdit,
  type Planner,
} from './planner';

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

const at = (member: SlotPosition['member'], slot: SlotPosition['slot']): SlotPosition => ({ member, slot });

const a = trait('a--one');
const b = trait('b--two');
const c = trait('c--three');
const mastery = trait('master-of-mirelings', { kind: 'mastery' });

/** Adds a trait the slot rules accept: a refusal here would be a mistake in the test. */
function added(planner: Planner, toAdd: Trait): Planner {
  const result = addTrait(planner, toAdd);
  if (!result.ok) throw new Error(`the trait was refused: ${result.reason}`);
  return result.planner;
}

describe('createPlanner', () => {
  it('starts on an empty party with the target on its first slot and nothing to undo', () => {
    const planner = createPlanner();

    expect(planner.history.party).toBe(emptyParty);
    expect(planner.target).toEqual(at(0, 'innate'));
    expect(canUndo(planner.history)).toBe(false);
  });

  it('starts on the party and the target it is given, which are not edits to undo', () => {
    const party = withTraitAt(emptyParty, at(0, 'innate'), 'a--one');

    const planner = createPlanner({ party, target: at(2, 'fused') });

    expect(planner.history.party).toBe(party);
    expect(planner.target).toEqual(at(2, 'fused'));
    expect(canUndo(planner.history)).toBe(false);
  });
});

describe('addTrait', () => {
  it('puts the trait in the target slot and moves the target to the next empty one', () => {
    const planner = added(createPlanner(), a);

    expect(traitAt(planner.history.party, at(0, 'innate'))).toBe('a--one');
    expect(planner.target).toEqual(at(0, 'fused'));
  });

  it('fills the party slot by slot as traits are added', () => {
    const planner = [a, b, c].reduce(added, createPlanner());

    expect(SLOT_POSITIONS.slice(0, 3).map((position) => traitAt(planner.history.party, position))).toEqual([
      'a--one',
      'b--two',
      'c--three',
    ]);
    expect(planner.target).toEqual(at(1, 'innate'));
  });

  it('moves the target with the strategy it is given', () => {
    const lastSlot = () => at(5, 'artifact');

    const result = addTrait(createPlanner(), a, lastSlot);

    expect(result.ok && result.planner.target).toEqual(at(5, 'artifact'));
  });

  it('puts it in the slot chosen as target, and goes on from there', () => {
    const planner = added(chooseTarget(createPlanner(), at(2, 'artifact')), a);

    expect(traitAt(planner.history.party, at(2, 'artifact'))).toBe('a--one');
    expect(planner.target).toEqual(at(3, 'innate'));
  });

  it('replaces what the target slot held', () => {
    const first = added(createPlanner(), a);

    const replaced = added(chooseTarget(first, at(0, 'innate')), b);

    expect(traitAt(replaced.history.party, at(0, 'innate'))).toBe('b--two');
  });

  it('is refused with the reason of the slot rules, and nothing changes', () => {
    const planner = createPlanner();

    const result = addTrait(planner, mastery);

    expect(result).toEqual({
      ok: false,
      rule: 'special-traits-artifact-only',
      reason: 'Mastery traits can only go in the Artifact slot.',
    });
    expect(planner.history.party).toBe(emptyParty);
  });

  it('gives the very same planner when the target slot already holds that trait: nothing happened', () => {
    const planner = chooseTarget(added(createPlanner(), a), at(0, 'innate'));

    const result = addTrait(planner, a);

    expect(result.ok && result.planner).toBe(planner);
  });

  it('can be undone, and the target goes back to the slot the trait was put in', () => {
    const planner = undoEdit(added(createPlanner(), a));

    expect(planner.history.party).toBe(emptyParty);
    expect(planner.target).toEqual(at(0, 'innate'));
  });

  it('can be redone, and the target moves on again', () => {
    const planner = redoEdit(undoEdit(added(createPlanner(), a)));

    expect(traitAt(planner.history.party, at(0, 'innate'))).toBe('a--one');
    expect(planner.target).toEqual(at(0, 'fused'));
  });

  it('says nothing was replaced when the target slot was empty', () => {
    expect(addTrait(createPlanner(), a)).toMatchObject({ ok: true, replaced: null });
  });

  it('says which trait it replaced, so that the page can tell the player', () => {
    const first = added(createPlanner(), a);

    const result = addTrait(chooseTarget(first, at(0, 'innate')), b);

    expect(result).toMatchObject({ ok: true, replaced: 'a--one' });
  });

  it('says nothing was replaced when the slot held that very trait already', () => {
    const planner = chooseTarget(added(createPlanner(), a), at(0, 'innate'));

    expect(addTrait(planner, a)).toEqual({ ok: true, planner, replaced: null });
  });

  it('puts the replaced trait back when undone, in one step', () => {
    const first = added(createPlanner(), a);
    const replaced = added(chooseTarget(first, at(0, 'innate')), b);

    const undone = undoEdit(replaced);

    expect(traitAt(undone.history.party, at(0, 'innate'))).toBe('a--one');
  });
});

describe('addTraitAt', () => {
  it('puts the trait in the slot it is given, not in the target', () => {
    const planner = createPlanner();

    const result = addTraitAt(planner, a, at(2, 'fused'));

    expect(result.ok && traitAt(result.planner.history.party, at(2, 'fused'))).toBe('a--one');
    expect(result.ok && traitAt(result.planner.history.party, planner.target)).toBeNull();
  });

  it('leaves the target where it was when the slot is not the target: the player is still filling that one', () => {
    const planner = chooseTarget(createPlanner(), at(1, 'innate'));

    const result = addTraitAt(planner, mastery, at(1, 'artifact'));

    expect(result.ok && result.planner.target).toEqual(at(1, 'innate'));
  });

  it('moves the target on with the strategy when the slot is the target, as addTrait does', () => {
    const planner = chooseTarget(createPlanner(), at(1, 'artifact'));

    const result = addTraitAt(planner, mastery, at(1, 'artifact'));

    expect(result.ok && result.planner.target).toEqual(at(2, 'innate'));
    expect(result).toEqual(addTrait(planner, mastery));
  });

  it('moves the target with the strategy it is given', () => {
    const lastSlot = () => at(5, 'artifact');

    const result = addTraitAt(createPlanner(), a, at(0, 'innate'), lastSlot);

    expect(result.ok && result.planner.target).toEqual(at(5, 'artifact'));
  });

  it('says which trait the slot held, and replaces it', () => {
    const first = added(createPlanner(), a);

    const result = addTraitAt(first, b, at(0, 'innate'));

    expect(result.ok && traitAt(result.planner.history.party, at(0, 'innate'))).toBe('b--two');
    expect(result).toMatchObject({ ok: true, replaced: 'a--one' });
  });

  it('is refused with the reason of the rules for that slot, and nothing changes', () => {
    const planner = createPlanner();

    const result = addTraitAt(planner, mastery, at(0, 'fused'));

    expect(result).toEqual({
      ok: false,
      rule: 'special-traits-artifact-only',
      reason: 'Mastery traits can only go in the Artifact slot.',
    });
    expect(planner.history.party).toBe(emptyParty);
  });

  it('gives the very same planner when the slot holds that trait already', () => {
    const planner = added(createPlanner(), a);

    expect(addTraitAt(planner, a, at(0, 'innate'))).toEqual({ ok: true, planner, replaced: null });
  });

  it('is one step to undo, which puts the target on the slot that was filled, as for every edit', () => {
    const planner = chooseTarget(createPlanner(), at(1, 'innate'));
    const result = addTraitAt(planner, mastery, at(1, 'artifact'));
    if (!result.ok) throw new Error('the mastery was refused');

    const undone = undoEdit(result.planner);

    expect(undone.history.party).toBe(emptyParty);
    expect(undone.target).toEqual(at(1, 'artifact'));
  });
});

describe('chooseTarget', () => {
  it('moves the target and nothing else', () => {
    const planner = added(createPlanner(), a);

    const chosen = chooseTarget(planner, at(4, 'fused'));

    expect(chosen.target).toEqual(at(4, 'fused'));
    expect(chosen.history).toBe(planner.history);
  });

  it('gives the very same planner when that is the target already', () => {
    const planner = createPlanner();

    expect(chooseTarget(planner, at(0, 'innate'))).toBe(planner);
  });
});

describe('clearSlot', () => {
  it('empties the slot and makes it the target: it is where the next trait is wanted', () => {
    const planner = [a, b].reduce(added, createPlanner());

    const cleared = clearSlot(planner, at(0, 'innate'));

    expect(traitAt(cleared.history.party, at(0, 'innate'))).toBeNull();
    expect(traitAt(cleared.history.party, at(0, 'fused'))).toBe('b--two');
    expect(cleared.target).toEqual(at(0, 'innate'));
  });

  it('gives the very same planner when the slot is empty already', () => {
    const planner = added(createPlanner(), a);

    expect(clearSlot(planner, at(3, 'artifact'))).toBe(planner);
  });

  it('can be undone: the trait is back, and the target is its slot', () => {
    const planner = [a, b].reduce(added, createPlanner());

    const undone = undoEdit(clearSlot(planner, at(0, 'innate')));

    expect(undone.history.party).toBe(planner.history.party);
    expect(undone.target).toEqual(at(0, 'innate'));
  });
});

describe('clearParty', () => {
  it('empties the party and puts the target on its first slot', () => {
    const planner = chooseTarget([a, b, c].reduce(added, createPlanner()), at(5, 'artifact'));

    const cleared = clearParty(planner);

    expect(cleared.history.party).toEqual(emptyParty);
    expect(cleared.target).toEqual(at(0, 'innate'));
  });

  it('gives the very same planner when the party is empty already', () => {
    const planner = chooseTarget(createPlanner(), at(2, 'fused'));

    expect(clearParty(planner)).toBe(planner);
  });

  it('is one step to undo, which brings the party back with the target on its first empty slot', () => {
    const planner = [a, b, c].reduce(added, createPlanner());

    const undone = undoEdit(clearParty(planner));

    expect(undone.history.party).toBe(planner.history.party);
    expect(undone.target).toEqual(at(1, 'innate'));
  });
});

describe('undoEdit and redoEdit', () => {
  it('give the very same planner when there is nothing to undo or redo', () => {
    const planner = added(createPlanner(), a);

    const fresh = createPlanner();
    expect(redoEdit(planner)).toBe(planner);
    expect(undoEdit(fresh)).toBe(fresh);
  });

  it('redo what was undone, edit after edit, however far back', () => {
    const start = createPlanner();
    const planner = [a, b, c].reduce(added, start);

    const back = undoEdit(undoEdit(undoEdit(planner)));
    const forward = redoEdit(redoEdit(redoEdit(back)));

    expect(back.history.party).toBe(emptyParty);
    expect(forward.history.party).toBe(planner.history.party);
    expect(forward.target).toEqual(planner.target);
  });

  it('drop what could be redone when a trait is added after an undo', () => {
    const planner = added(undoEdit(added(createPlanner(), a)), b);

    expect(canRedo(planner.history)).toBe(false);
  });

  it('keep the redo list when a choice of target is made in between: that is not an edit', () => {
    const undone = undoEdit(added(createPlanner(), a));

    expect(canRedo(chooseTarget(undone, at(3, 'fused')).history)).toBe(true);
  });
});

describe('a planner, whatever was done to it', () => {
  type Step = (planner: Planner) => Planner;

  const position = fc.constantFrom(...SLOT_POSITIONS);
  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.tuple(position, fc.constantFrom(a, b, c, mastery)).map(([where, toAdd]): Step => (planner) => {
      const result = addTrait(chooseTarget(planner, where), toAdd);
      return result.ok ? result.planner : planner;
    }),
    position.map(
      (where): Step =>
        (planner) =>
          clearSlot(planner, where),
    ),
    fc.constant<Step>(clearParty),
    fc.constant<Step>(undoEdit),
    fc.constant<Step>(redoEdit),
    position.map(
      (where): Step =>
        (planner) =>
          chooseTarget(planner, where),
    ),
  );

  it('is on the same party after an undo and a redo', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        const planner = steps.reduce((current, next) => next(current), createPlanner());

        if (canUndo(planner.history)) expect(redoEdit(undoEdit(planner)).history.party).toBe(planner.history.party);
      }),
    );
  });

  it('never holds a trait where the slot rules refuse it', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        const planner = steps.reduce((current, next) => next(current), createPlanner());

        for (const slot of SLOT_POSITIONS) {
          if (slot.slot !== 'artifact') expect(traitAt(planner.history.party, slot)).not.toBe(mastery.id);
        }
      }),
    );
  });
});
