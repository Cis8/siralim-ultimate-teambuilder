import type { SlotPosition, Trait } from '@atlas/core';
import { copy } from './copy';
import type { Focusable, PartyActions } from './party-actions';

/** What the "add" button of a trait says and does, from what the party says of the trait (DESIGN § Party panel). */
export interface AddControl {
  /** Why the trait cannot go in the target slot, or `null`. The reason is on the page and tied to the button (SPEC §8.2). */
  readonly refusal: string | null;
  /**
   * A trait the target refuses but another slot of the creature takes: the button stays active, opens the choice of slot, and
   * says so ("Add to…"). With no slot to offer it stays in the tab order with `aria-disabled`, and a press only says why.
   */
  readonly chooses: boolean;
  /** The slots that hold the trait, in reading order. */
  readonly places: readonly SlotPosition[];
  /** The words on a button that has words. */
  readonly label: string;
  /** The name of the button: the label and the trait too, since a phone draws no words and a list of them must tell them apart. */
  readonly name: string;
}

export function addControl(trait: Trait, party: PartyActions): AddControl {
  const refusal = party.refusal(trait);
  const chooses = refusal !== null && party.canChooseSlot(trait);
  return {
    refusal,
    chooses,
    places: party.placesOf(trait),
    label: chooses ? copy.addToElsewhere : copy.addTo(party.target),
    name: chooses ? copy.addToElsewhereTrait(trait.name) : copy.addToTrait(party.target, trait.name),
  };
}

/** A press: the choice of slot where there is one to offer, else the target slot, which announces a refusal. */
export function pressAdd(trait: Trait, party: PartyActions, opener: Focusable): void {
  if (addControl(trait, party).chooses) party.chooseSlot(trait, opener);
  else party.add(trait);
}
