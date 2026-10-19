import type { Trait } from '../model/trait';
import { bestMatchTier, matchTier, type FitTier } from '../suggest/match-tier';
import { familyOf } from './same-family';
import { compareTraitsByName } from './trait-order';

/** Best first, as a suggestion is ranked (QUERY_LANGUAGE §6). */
const TIERS: readonly FitTier[] = ['prefix', 'word-start', 'substring'];

/**
 * The traits a person looking for a focus means by `text`, best fit first, at most `limit`: the name begins with it, has a word
 * that does, or has it inside; then the creature or the family does. Fits alike are in the order of a list a reader looks
 * through. Blanks around the text and the case are ignored; nothing typed finds nothing (the picker invites instead of listing).
 */
export function findTraits(traits: readonly Trait[], text: string, limit: number): readonly Trait[] {
  const typed = text.trim().toLowerCase();
  if (typed === '' || limit < 1) return [];
  const fitting: { readonly trait: Trait; readonly rank: number }[] = [];
  for (const trait of traits) {
    const rank = rankOf(trait, typed);
    if (rank !== undefined) fitting.push({ trait, rank });
  }
  return fitting
    .toSorted((a, b) => a.rank - b.rank || compareTraitsByName(a.trait, b.trait))
    .slice(0, limit)
    .map(({ trait }) => trait);
}

/** How well `typed` fits the trait, 0 being the best, or `undefined` when it fits nothing: every fit to the name beats every fit to the rest. */
function rankOf(trait: Trait, typed: string): number | undefined {
  const byName = matchTier(typed, trait.name.toLowerCase());
  if (byName !== undefined) return TIERS.indexOf(byName);
  const byGroup = bestMatchTier(typed, [trait.creature?.toLowerCase() ?? '', familyOf(trait).toLowerCase()]);
  return byGroup === undefined ? undefined : TIERS.length + TIERS.indexOf(byGroup);
}
