import type { Trait } from '../model/trait';
import { emptyParty, MEMBER_INDEXES, SLOT_NAMES, traitAt, withTraitAt, type Party, type SlotPosition } from './party';
import type { Placement } from './slot-rule';
import type { SlotRuleRegistry } from './slot-rule-registry';
import { slotRules } from './slot-rules';

/**
 * One edit of the party, as data: what the player asked for, not how it is done (`applyCommand` does that). The history
 * keeps it next to the parties around it, so the page can say what was undone.
 */
export type PartyCommand =
  | { readonly type: 'place-trait'; readonly at: SlotPosition; readonly trait: Trait }
  | { readonly type: 'clear-slot'; readonly at: SlotPosition }
  | { readonly type: 'clear-party' };

/** A placement the slot rules refuse: which rule, and the sentence to show. */
export type Refusal = Extract<Placement, { readonly ok: false }>;

/** The party after the command, or why the command was refused. */
export type CommandResult = { readonly ok: true; readonly party: Party } | Refusal;

/**
 * Applies a command to a party. A command that changes nothing gives the very same party, which is how the history knows
 * not to record it; one that the slot rules refuse gives the refusal and no party.
 */
export function applyCommand(party: Party, command: PartyCommand, rules: SlotRuleRegistry = slotRules): CommandResult {
  switch (command.type) {
    case 'place-trait': {
      const placement = rules.canPlace(command.trait, command.at.slot);
      return placement.ok ? { ok: true, party: withTraitAt(party, command.at, command.trait.id) } : placement;
    }
    case 'clear-slot':
      return { ok: true, party: withTraitAt(party, command.at, null) };
    case 'clear-party':
      return { ok: true, party: isEmpty(party) ? party : emptyParty };
  }
}

function isEmpty(party: Party): boolean {
  return MEMBER_INDEXES.every((member) => SLOT_NAMES.every((slot) => traitAt(party, { member, slot }) === null));
}
