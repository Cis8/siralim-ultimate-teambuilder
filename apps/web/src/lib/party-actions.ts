import type { SlotPosition, Trait } from '@atlas/core';

/** What a result can do with the party it is shown beside: the "add" button and the "in party" marker. */
export interface PartyActions {
  /** The slot "add" puts a trait in. */
  readonly target: SlotPosition;
  /** Why `trait` cannot go in the target slot, as a sentence to show; `null` when it can. */
  refusal(trait: Trait): string | null;
  /** Puts `trait` in the target slot. A refusal is announced and changes nothing. */
  add(trait: Trait): void;
  /** Whether some slot of the target's creature takes `trait`: a trait the target refuses can then be put in another slot. */
  canChooseSlot(trait: Trait): boolean;
  /** Opens the choice of slot for `trait`. `opener` is the button that was pressed: it gets the focus back when the choice is over. */
  chooseSlot(trait: Trait, opener: HTMLElement): void;
  /** The slots that hold `trait`, in reading order. */
  placesOf(trait: Trait): readonly SlotPosition[];
}
