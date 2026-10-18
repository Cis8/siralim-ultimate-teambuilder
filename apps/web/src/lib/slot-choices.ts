import {
  allowedSlots,
  slotRules,
  traitAt,
  type MemberIndex,
  type Party,
  type SlotPosition,
  type SlotRuleRegistry,
  type Trait,
  type TraitLookup,
} from '@atlas/core';

/** What a slot holds as the chooser words it: nothing, the trait being added already, or another trait (named, since it would be replaced). */
export type SlotHolds =
  { readonly kind: 'empty' } | { readonly kind: 'this' } | { readonly kind: 'other'; readonly name: string };

/** One slot of a creature that takes the trait, and what it holds now. */
export interface SlotChoice {
  readonly position: SlotPosition;
  readonly holds: SlotHolds;
}

/**
 * Where `trait` can go on a creature when the target slot refuses it: the slots the rules allow, in the order of the creature,
 * each with what it holds, since adding there replaces it. Empty when no slot takes the trait. A trait the dataset does not know
 * (a shared party can hold one) is named by its id.
 */
export function slotChoices(
  party: Party,
  member: MemberIndex,
  trait: Trait,
  lookup: TraitLookup,
  rules: SlotRuleRegistry = slotRules,
): readonly SlotChoice[] {
  return allowedSlots(trait, rules).map((slot) => {
    const position = { member, slot };
    const held = traitAt(party, position);
    if (held === null) return { position, holds: { kind: 'empty' } };
    if (held === trait.id) return { position, holds: { kind: 'this' } };
    return { position, holds: { kind: 'other', name: lookup(held)?.name ?? held } };
  });
}
