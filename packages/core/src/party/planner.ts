import type { Trait } from '../model/trait';
import { sameSlot, type SlotPosition } from './party';
import type { Refusal } from './party-command';
import { createPartyHistory, executeCommand, redo, undo, type PartyEdit, type PartyHistory } from './party-history';
import { initialPartyState, type PartyState } from './party-state';
import { firstEmptySlot, nextEmptySlot, type TargetStrategy } from './target-strategy';

/**
 * The party being planned: its history, and the slot the next trait goes to (SPEC §8.2). Immutable, like the party: every
 * operation gives another planner, or the very same one when nothing happened (a click that changed nothing is told by
 * identity, as in `withTraitAt`).
 */
export interface Planner {
  readonly history: PartyHistory;
  readonly target: SlotPosition;
}

/** A planner on the party and target given (one from a link), with nothing to undo; an empty party by default. */
export function createPlanner({ party, target }: PartyState = initialPartyState): Planner {
  return { history: createPartyHistory(party), target };
}

/**
 * Puts the trait in the target slot, if the slot rules allow, and moves the target on with `strategy`. A refusal comes back
 * with its reason; a trait that is in the target slot already changes nothing, the target included.
 */
export function addTrait(
  planner: Planner,
  trait: Trait,
  strategy: TargetStrategy = nextEmptySlot,
): { readonly ok: true; readonly planner: Planner } | Refusal {
  const result = executeCommand(planner.history, { type: 'place-trait', at: planner.target, trait });
  if (!result.ok) return result;
  if (result.history === planner.history) return { ok: true, planner };
  return { ok: true, planner: { history: result.history, target: strategy(result.history.party, planner.target) } };
}

/** Empties a slot and makes it the target: it is where the next trait is wanted. */
export function clearSlot(planner: Planner, at: SlotPosition): Planner {
  const result = executeCommand(planner.history, { type: 'clear-slot', at });
  return result.ok && result.history !== planner.history ? { history: result.history, target: at } : planner;
}

/** Empties the party, in one step to undo, and puts the target on its first slot. */
export function clearParty(planner: Planner): Planner {
  const result = executeCommand(planner.history, { type: 'clear-party' });
  return result.ok && result.history !== planner.history
    ? { history: result.history, target: firstEmptySlot(result.history.party) }
    : planner;
}

/** Chooses the slot the next trait goes to. Not an edit of the party: it is not undone, and keeps what can be redone. */
export function chooseTarget(planner: Planner, at: SlotPosition): Planner {
  return sameSlot(planner.target, at) ? planner : { history: planner.history, target: at };
}

/** Takes back the last edit and puts the target where that edit was made, so that the next trait refills the slot. */
export function undoEdit(planner: Planner): Planner {
  const edit = planner.history.done.at(-1);
  if (edit === undefined) return planner;
  return { history: undo(planner.history), target: targetBefore(edit) };
}

/** Brings back the last edit that was taken back, with the target where doing it the first time would have left it. */
export function redoEdit(planner: Planner, strategy: TargetStrategy = nextEmptySlot): Planner {
  const edit = planner.history.undone.at(-1);
  if (edit === undefined) return planner;
  return { history: redo(planner.history), target: targetAfter(edit, strategy) };
}

function targetBefore({ command, before }: PartyEdit): SlotPosition {
  return command.type === 'clear-party' ? firstEmptySlot(before) : command.at;
}

function targetAfter({ command, after }: PartyEdit, strategy: TargetStrategy): SlotPosition {
  switch (command.type) {
    case 'place-trait':
      return strategy(after, command.at);
    case 'clear-slot':
      return command.at;
    case 'clear-party':
      return firstEmptySlot(after);
  }
}
