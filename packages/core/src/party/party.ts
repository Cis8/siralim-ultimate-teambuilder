import type { TraitId } from '../model/trait';

/** The three trait slots of a creature (GAME_RULES R1). */
export const SLOT_NAMES = ['innate', 'fused', 'artifact'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/** A party has six creatures (GAME_RULES R1). */
export const MEMBER_INDEXES = [0, 1, 2, 3, 4, 5] as const;
export type MemberIndex = (typeof MEMBER_INDEXES)[number];

/**
 * One creature of the party: the trait ids in its three slots, `null` where a slot is empty. An id is kept whether or not
 * the dataset knows it, since a shared party can come from another version of the compendium (SPEC §5).
 */
export interface PartyMember {
  readonly innate: TraitId | null;
  readonly fused: TraitId | null;
  readonly artifact: TraitId | null;
}

/** Six creatures, always: immutable, changed only by `withTraitAt`, which gives another party. */
export type Party = readonly [PartyMember, PartyMember, PartyMember, PartyMember, PartyMember, PartyMember];

/** One of the 18 slots of a party. */
export interface SlotPosition {
  readonly member: MemberIndex;
  readonly slot: SlotName;
}

/** The 18 slots in reading order, creature by creature, Innate then Fused then Artifact: the order a party is listed in. */
export const SLOT_POSITIONS: readonly SlotPosition[] = MEMBER_INDEXES.flatMap((member) =>
  SLOT_NAMES.map((slot) => ({ member, slot })),
);

export const sameSlot = (a: SlotPosition, b: SlotPosition): boolean => a.member === b.member && a.slot === b.slot;

const emptyMember: PartyMember = { innate: null, fused: null, artifact: null };

export const emptyParty: Party = [emptyMember, emptyMember, emptyMember, emptyMember, emptyMember, emptyMember];

/** Whether no slot holds a trait. */
export function isEmptyParty(party: Party): boolean {
  return SLOT_POSITIONS.every((at) => traitAt(party, at) === null);
}

/** How many of the 18 slots hold a trait; a trait in two slots counts twice. */
export function filledSlots(party: Party): number {
  return SLOT_POSITIONS.filter((at) => traitAt(party, at) !== null).length;
}

export function traitAt(party: Party, { member, slot }: SlotPosition): TraitId | null {
  return party[member][slot];
}

/**
 * The party with `id` in that slot (`null` empties it), and every other slot as it was. When the slot already holds that,
 * the very same party comes back, so that a change which changed nothing is told by identity.
 *
 * This only writes. Whether the trait may sit in the slot needs the trait itself, not its id: `slotRules.canPlace` tells,
 * and a command that places a trait asks it first.
 */
export function withTraitAt(party: Party, { member, slot }: SlotPosition, id: TraitId | null): Party {
  if (party[member][slot] === id) return party;
  const changed: PartyMember = { ...party[member], [slot]: id };
  return [
    member === 0 ? changed : party[0],
    member === 1 ? changed : party[1],
    member === 2 ? changed : party[2],
    member === 3 ? changed : party[3],
    member === 4 ? changed : party[4],
    member === 5 ? changed : party[5],
  ];
}
