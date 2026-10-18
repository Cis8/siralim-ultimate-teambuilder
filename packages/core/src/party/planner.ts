import type { Trait, TraitId } from '../model/trait';
import { sameSlot, traitAt, type SlotPosition } from './party';
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
 * What adding a trait came to: the planner after it, and the trait the slot held until then (`replaced`: its id, since a
 * party keeps ids; `null` when the slot was empty or already held this very trait), or the slot rules' refusal.
 */
export type AddResult = { readonly ok: true; readonly planner: Planner; readonly replaced: TraitId | null } | Refusal;

/**
 * Puts the trait in the target slot, if the slot rules allow, and moves the target on with `strategy`. A refusal comes back
 * with its reason; a trait that is in the target slot already changes nothing, the target included.
 */
export function addTrait(planner: Planner, trait: Trait, strategy: TargetStrategy = nextEmptySlot): AddResult {
  return addTraitAt(planner, trait, planner.target, strategy);
}

/**
 * Puts the trait in the slot `at`, which need not be the target: a trait the target slot refuses goes to another slot of
 * the creature. The target moves on with `strategy` only when `at` is the target; the player is still filling the target
 * otherwise, and it stays. What the slot held is replaced, and said (`replaced`). A trait that is in the slot already
 * changes nothing, and gives the very same planner.
 */
export function addTraitAt(
  planner: Planner,
  trait: Trait,
  at: SlotPosition,
  strategy: TargetStrategy = nextEmptySlot,
): AddResult {
  const result = executeCommand(planner.history, { type: 'place-trait', at, trait });
  if (!result.ok) return result;
  if (result.history === planner.history) return { ok: true, planner, replaced: null };
  const target = sameSlot(at, planner.target) ? strategy(result.history.party, planner.target) : planner.target;
  return { ok: true, planner: { history: result.history, target }, replaced: traitAt(planner.history.party, at) };
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
