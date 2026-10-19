import type { Trait, TraitKind } from '../model/trait';
import { eligibleTraits, type RelationOptions } from './relation-options';
import { compareTraitsByName } from './trait-order';

export interface SameFamily {
  /** The family the focus belongs to. */
  readonly family: string;
  /**
   * The name files several traits together, and no mastery trait is named for it: Exotic, Backer, Avatar and Zantai in v2.0, where
   * every other family has exactly one. Such a name is a grouping of the sheet and not a family (PLAN D36), so a list of "the same
   * family" would say nothing. Whatever the filter.
   */
  readonly grouping: boolean;
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
  const members = membersOf(family);
  return {
    family,
    grouping: members.length > 1 && !members.some((trait) => trait.kind === 'mastery'),
    entries: members.filter((trait) => trait.id !== focus.id && eligible(trait)).toSorted(byKindThenName),
  };
}

function byKindThenName(a: Trait, b: Trait): number {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || compareTraitsByName(a, b);
}
