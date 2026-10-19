import type { Trait, TraitKind } from '../model/trait';
import { eligibleTraits, type RelationOptions } from './relation-options';
import { compareTraitsByName } from './trait-order';

export interface SameFamily {
  /** The family the focus belongs to. */
  readonly family: string;
  /** The other traits of it: masteries first, then creatures, avatars, backers and the rest, each kind by name. */
  readonly entries: readonly Trait[];
}

/** The order of the kinds in the list: the mastery of the family comes first (SPEC §8.4). */
const KIND_RANK: Record<TraitKind, number> = { mastery: 0, creature: 1, avatar: 2, backer: 3, other: 4 };

/** The family a trait belongs to. A mastery is the one of its Family column (`masteryFamily`, GAME_RULES R3). */
export function familyOf(trait: Trait): string {
  return trait.masteryFamily ?? trait.family;
}

/** The others of the family of the focus. Pure: the index hands it the members of each family it knows. */
export function sameFamilyOfTrait(
  focus: Trait,
  membersOf: (family: string) => readonly Trait[],
  options: RelationOptions,
): SameFamily {
  const eligible = eligibleTraits(options);
  const family = familyOf(focus);
  return {
    family,
    entries: membersOf(family)
      .filter((trait) => trait.id !== focus.id && eligible(trait))
      .toSorted(byKindThenName),
  };
}

function byKindThenName(a: Trait, b: Trait): number {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || compareTraitsByName(a, b);
}
