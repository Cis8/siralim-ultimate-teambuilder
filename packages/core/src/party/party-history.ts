import { emptyParty, type Party } from './party';
import { applyCommand, type PartyCommand, type Refusal } from './party-command';
import type { SlotRuleRegistry } from './slot-rule-registry';
import { slotRules } from './slot-rules';

/** A command that changed the party, with the party on either side of it. */
export interface PartyEdit {
  readonly command: PartyCommand;
  readonly before: Party;
  readonly after: Party;
}

/**
 * The party and the edits that led to it. Both lists are stacks with the next edit to step over at the end: `done` has the
 * oldest edit first and the one `undo` takes back last; `undone` has the one `redo` brings back last.
 */
export interface PartyHistory {
  readonly party: Party;
  readonly done: readonly PartyEdit[];
  readonly undone: readonly PartyEdit[];
}

/** A history on `party` with nothing to undo: a party that came from a link is where the player starts, not an edit. */
export function createPartyHistory(party: Party = emptyParty): PartyHistory {
  return { party, done: [], undone: [] };
}

export function canUndo(history: PartyHistory): boolean {
  return history.done.length > 0;
}

export function canRedo(history: PartyHistory): boolean {
  return history.undone.length > 0;
}

/**
 * Runs a command. When it changed the party, it is recorded and what could be redone is dropped; when it changed nothing,
 * the very same history comes back, redo list included, since nothing new was done. A refused command gives the refusal and
 * leaves the history as it is.
 */
export function executeCommand(
  history: PartyHistory,
  command: PartyCommand,
  rules: SlotRuleRegistry = slotRules,
): { readonly ok: true; readonly history: PartyHistory } | Refusal {
  const result = applyCommand(history.party, command, rules);
  if (!result.ok) return result;
  if (result.party === history.party) return { ok: true, history };
  const edit: PartyEdit = { command, before: history.party, after: result.party };
  return { ok: true, history: { party: result.party, done: [...history.done, edit], undone: [] } };
}

/** Takes back the last edit; the very same history when there is none. */
export function undo(history: PartyHistory): PartyHistory {
  const edit = history.done.at(-1);
  if (edit === undefined) return history;
  return { party: edit.before, done: history.done.slice(0, -1), undone: [...history.undone, edit] };
}

/** Brings back the last edit that was taken back; the very same history when there is none. */
export function redo(history: PartyHistory): PartyHistory {
  const edit = history.undone.at(-1);
  if (edit === undefined) return history;
  return { party: edit.after, done: [...history.done, edit], undone: history.undone.slice(0, -1) };
}
