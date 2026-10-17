import { emptyParty, sameSlot, SLOT_POSITIONS, traitAt, type Party, type SlotPosition } from './party';
import { firstEmptySlot } from './target-strategy';

/** What the page keeps of the party between two visits: the slots, and the one the next trait goes to. */
export interface PartyState {
  readonly party: Party;
  readonly target: SlotPosition;
}

/** The party of a page opened with none: empty, with the target on its first slot. It is what an address without a party stands for. */
export const initialPartyState: PartyState = { party: emptyParty, target: firstEmptySlot(emptyParty) };

/** Whether two states hold the same trait in every slot and have the same target, whatever objects they are. */
export function samePartyState(a: PartyState, b: PartyState): boolean {
  return sameSlot(a.target, b.target) && SLOT_POSITIONS.every((at) => traitAt(a.party, at) === traitAt(b.party, at));
}
