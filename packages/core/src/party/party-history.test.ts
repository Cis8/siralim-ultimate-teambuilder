import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { emptyParty, MEMBER_INDEXES, SLOT_NAMES, traitAt, withTraitAt, type SlotPosition } from './party';
import type { PartyCommand } from './party-command';
import { canRedo, canUndo, createPartyHistory, executeCommand, redo, undo, type PartyHistory } from './party-history';

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

const first: SlotPosition = { member: 0, slot: 'innate' };
const second: SlotPosition = { member: 1, slot: 'fused' };

const mender = trait('life--mender');
const brute = trait('abomination--brute');
const mastery = trait('master-of-mirelings', { kind: 'mastery' });

/** Runs a command that the slot rules accept: a refusal here would be a mistake in the test. */
function executed(history: PartyHistory, command: PartyCommand): PartyHistory {
  const result = executeCommand(history, command);
  if (!result.ok) throw new Error(`the command was refused: ${result.reason}`);
  return result.history;
}

function place(at: SlotPosition, withTrait: Trait): PartyCommand {
  return { type: 'place-trait', at, trait: withTrait };
}

function undoAll(history: PartyHistory): PartyHistory {
  return canUndo(history) ? undoAll(undo(history)) : history;
}

function redoAll(history: PartyHistory): PartyHistory {
  return canRedo(history) ? redoAll(redo(history)) : history;
}

describe('createPartyHistory', () => {
  it('starts on an empty party with nothing to undo or redo', () => {
    const history = createPartyHistory();

    expect(history.party).toBe(emptyParty);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('starts on the party it is given (one that came from a link), which is not an edit to undo', () => {
    const shared = withTraitAt(emptyParty, first, 'a--one');

    const history = createPartyHistory(shared);

    expect(history.party).toBe(shared);
    expect(canUndo(history)).toBe(false);
  });
});

describe('executeCommand', () => {
  it('moves to the party the command gives, and can be undone', () => {
    const history = executed(createPartyHistory(), place(first, mender));

    expect(traitAt(history.party, first)).toBe('life--mender');
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
  });

  it('records the command with the party before and after it, for the page to say what was undone', () => {
    const command = place(first, mender);
    const start = createPartyHistory();

    const history = executed(start, command);

    expect(history.done).toEqual([{ command, before: emptyParty, after: history.party }]);
  });

  it.each<[string, PartyCommand]>([
    ['placing the trait the slot holds', place(first, mender)],
    ['clearing an empty slot', { type: 'clear-slot', at: second }],
  ])('does not record %s, and gives the very same history', (_, command) => {
    const history = executed(createPartyHistory(), place(first, mender));

    const result = executeCommand(history, command);

    expect(result.ok && result.history).toBe(history);
  });

  it('does not record a clear of a party that is empty', () => {
    const history = createPartyHistory();

    const result = executeCommand(history, { type: 'clear-party' });

    expect(result.ok && result.history).toBe(history);
  });

  it('keeps what can be redone when the command changed nothing: it was not a new command', () => {
    const undone = undo(executed(createPartyHistory(), place(first, mender)));

    const result = executeCommand(undone, { type: 'clear-slot', at: first });

    expect(result.ok && canRedo(result.history)).toBe(true);
  });

  it('drops what can be redone when a new command is run', () => {
    const undone = undo(executed(createPartyHistory(), place(first, mender)));

    const history = executed(undone, place(second, brute));

    expect(canRedo(history)).toBe(false);
    expect(redo(history)).toBe(history);
  });

  it('refuses a placement the slot rules refuse, says why, and records nothing', () => {
    const history = executed(createPartyHistory(), place(first, mender));

    const result = executeCommand(history, place(second, mastery));

    expect(result).toEqual({
      ok: false,
      rule: 'special-traits-artifact-only',
      reason: 'Mastery traits can only go in the Artifact slot.',
    });
    expect(history.done).toHaveLength(1);
  });

  it('keeps what can be redone when a placement is refused', () => {
    const undone = undo(executed(createPartyHistory(), place(first, mender)));

    executeCommand(undone, place(second, mastery));

    expect(canRedo(undone)).toBe(true);
  });
});

describe('undo', () => {
  it('goes back to the party before the last command, one command at a time', () => {
    const afterOne = executed(createPartyHistory(), place(first, mender));
    const afterTwo = executed(afterOne, place(second, brute));

    const backToOne = undo(afterTwo);
    const backToStart = undo(backToOne);

    expect(backToOne.party).toBe(afterOne.party);
    expect(backToStart.party).toBe(emptyParty);
  });

  it('undoes a whole clear of the party as one step', () => {
    const filled = executed(executed(createPartyHistory(), place(first, mender)), place(second, brute));

    const cleared = executed(filled, { type: 'clear-party' });

    expect(cleared.party).toEqual(emptyParty);
    expect(undo(cleared).party).toBe(filled.party);
  });

  it('puts the command back in the redo list and out of the undo one', () => {
    const command = place(first, mender);
    const history = undo(executed(createPartyHistory(), command));

    expect(canUndo(history)).toBe(false);
    expect(history.undone).toEqual([{ command, before: emptyParty, after: withTraitAt(emptyParty, first, mender.id) }]);
  });

  it('gives the very same history when there is nothing to undo', () => {
    const history = createPartyHistory();

    expect(undo(history)).toBe(history);
  });

  it('does not go back past a party the history started on', () => {
    const shared = withTraitAt(emptyParty, first, 'a--one');
    const history = undo(executed(createPartyHistory(shared), place(second, brute)));

    expect(history.party).toBe(shared);
    expect(undo(history)).toBe(history);
  });
});

describe('redo', () => {
  it('goes forward again to the party that was undone', () => {
    const afterTwo = executed(executed(createPartyHistory(), place(first, mender)), place(second, brute));

    const back = undo(undo(afterTwo));

    expect(redo(back).party).not.toBe(emptyParty);
    expect(redo(redo(back)).party).toBe(afterTwo.party);
  });

  it('gives the very same history when there is nothing to redo', () => {
    const history = executed(createPartyHistory(), place(first, mender));

    expect(redo(history)).toBe(history);
  });
});

describe('a history, whatever was done to it', () => {
  type Operation = (history: PartyHistory) => PartyHistory;

  /** A command as an operation: the slot rules may refuse it, and then the history stays as it is. */
  function running(command: PartyCommand): Operation {
    return (history) => {
      const result = executeCommand(history, command);
      return result.ok ? result.history : history;
    };
  }

  const position = fc.record({ member: fc.constantFrom(...MEMBER_INDEXES), slot: fc.constantFrom(...SLOT_NAMES) });
  const operation: fc.Arbitrary<Operation> = fc.oneof(
    fc
      .tuple(position, fc.constantFrom(mender, brute, mastery, trait('no-material--one', { material: null })))
      .map(([at, placed]) => running(place(at, placed))),
    position.map((at) => running({ type: 'clear-slot', at })),
    fc.constant(running({ type: 'clear-party' })),
    fc.constant(undo),
    fc.constant(redo),
  );
  const operations = fc.array(operation, { maxLength: 40 });

  /** Every state a history passes through while the operations run. */
  function run(ops: readonly Operation[]): PartyHistory[] {
    const states = [createPartyHistory()];
    for (const op of ops) states.push(op(states[states.length - 1] ?? createPartyHistory()));
    return states;
  }

  it('records only edits that changed the party', () => {
    fc.assert(
      fc.property(operations, (ops) => {
        for (const { done, undone } of run(ops)) {
          for (const edit of [...done, ...undone]) expect(edit.after).not.toBe(edit.before);
        }
      }),
    );
  });

  it('chains its edits: each starts where the one before it ended, and the party is where they meet', () => {
    fc.assert(
      fc.property(operations, (ops) => {
        for (const { party, done, undone } of run(ops)) {
          done.forEach((edit, index) => {
            expect(edit.before).toBe(index === 0 ? emptyParty : done[index - 1]?.after);
          });
          expect(done.at(-1)?.after ?? emptyParty).toBe(party);
          expect(undone.at(-1)?.before ?? party).toBe(party);
          undone.forEach((edit, index) => {
            if (index > 0) expect(undone[index - 1]?.before).toBe(edit.after);
          });
        }
      }),
    );
  });

  it('is back where it was after an undo and a redo', () => {
    fc.assert(
      fc.property(operations, (ops) => {
        const history = run(ops).at(-1);
        if (history === undefined || !canUndo(history)) return;

        expect(redo(undo(history)).party).toBe(history.party);
        expect(redo(undo(history))).toEqual(history);
      }),
    );
  });

  it('undoes all the way back to the empty party, and redoes all the way forward again', () => {
    fc.assert(
      fc.property(operations, (ops) => {
        const newest = redoAll(run(ops).at(-1) ?? createPartyHistory());

        const oldest = undoAll(newest);

        expect(oldest.party).toBe(emptyParty);
        expect(redoAll(oldest).party).toBe(newest.party);
      }),
    );
  });
});
