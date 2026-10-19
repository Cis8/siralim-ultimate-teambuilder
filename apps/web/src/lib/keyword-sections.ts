import type { KeywordView } from '@atlas/core';
import { copy } from './copy';
import { FOLD_ABOVE } from './lane-groups';
import type { CardGroup, RelatedCard, RelatedSectionModel } from './related-sections';

/**
 * The lists of the page of a keyword (SPEC §8.4), worded and ready to draw: who applies it by name and who relies on it. The traits
 * that give it under a condition or at random are not appliers (PLAN D29): they follow the appliers as groups of their own, so that
 * the number in the heading is the one the summary and the chips say. The view ranks them already.
 */
export function keywordSections(
  { appliers, conditional, random, users }: KeywordView,
  label: string,
  artifactOnly: boolean,
): readonly [applying: RelatedSectionModel, relying: RelatedSectionModel] {
  const groups = [
    ...group('conditional', copy.conditionalSources(conditional.length), copy.conditionalSourcesHint, conditional),
    ...group('random', copy.randomSources(random.length), copy.randomSourcesHint, random),
  ];
  return [
    {
      id: 'appliers',
      title: copy.appliers,
      hint: copy.appliersHint(label),
      cards: appliers.map((trait): RelatedCard => ({ trait })),
      empty: groups.length > 0 ? copy.noApplierByName(label, artifactOnly) : copy.noApplier(label, artifactOnly),
      counted: true,
      groups,
    },
    {
      id: 'users',
      title: copy.users,
      hint: copy.usersHint(label),
      cards: users.map((trait): RelatedCard => ({ trait })),
      empty: copy.noUser(label, artifactOnly),
      counted: true,
    },
  ];
}

/** The group for the traits that give the key in one weaker way: none when there are none. */
function group(
  id: CardGroup['id'],
  title: string,
  hint: string,
  traits: KeywordView['appliers'],
): readonly CardGroup[] {
  if (traits.length === 0) return [];
  return [{ id, title, hint, cards: traits.map((trait) => ({ trait, tier: id })), folded: traits.length > FOLD_ABOVE }];
}
