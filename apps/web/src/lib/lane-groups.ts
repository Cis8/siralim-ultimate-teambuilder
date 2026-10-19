import type { RelatedTrait } from '@atlas/core';

/** More random sources than this are folded away behind a button: there can be dozens (Flesh Rot has 27), and they are the least certain. */
export const FOLD_ABOVE = 3;

/** A lane of the page of a trait as it is drawn: the traits that give the key for sure, then the random sources as a group of their own. */
export interface LaneGroups {
  /** Give the key by name, or conditionally (GAME_RULES R10): the card says which. */
  readonly certain: readonly RelatedTrait[];
  /** Afflict a random debuff on enemies (R5): any one of the debuffs is theirs only by chance. */
  readonly random: readonly RelatedTrait[];
  /** There are too many random sources to list them all at once. */
  readonly folded: boolean;
}

/** Splits a lane, which is ranked already (the random sources last): the order is kept inside each group. */
export function groupLane(entries: readonly RelatedTrait[]): LaneGroups {
  const random = entries.filter(({ strength }) => strength === 'random');
  return {
    certain: entries.filter(({ strength }) => strength !== 'random'),
    random,
    folded: random.length > FOLD_ABOVE,
  };
}
