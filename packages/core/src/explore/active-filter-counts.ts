import type { ExploreState } from './explore-state';
import { FACET_KEYWORD_KINDS, type FacetKeywordKind, type KeywordFacet } from './facets';

/** The parts of the filter panel that open and close (SPEC §8.1), in the order it shows them. */
export const FILTER_SECTIONS = ['class', ...FACET_KEYWORD_KINDS, 'flags'] as const;
export type FilterSection = (typeof FILTER_SECTIONS)[number];

/**
 * How many filters are on in each section, for a section that is shut to say so. Every filter counts once, as it does in the
 * chip row and in "Clear filters": the two sides of a keyword are two filters. A keyword the panel does not list (an address
 * can name any) is in no section, so the counts can be short of the filters on, never beyond them.
 */
export function activeFilterCounts(
  state: ExploreState,
  keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[],
): Record<FilterSection, number> {
  const kindOf = new Map<string, FacetKeywordKind>(keywords.map(({ key, kind }) => [key, kind]));
  const counts: Record<FilterSection, number> = {
    class: state.classes.length,
    debuff: 0,
    buff: 0,
    effect: 0,
    trigger: 0,
    mechanic: 0,
    flags: Number(state.artifactEligible) + Number(state.doesNotStack),
  };
  for (const { key } of state.keywords) {
    const kind = kindOf.get(key);
    if (kind !== undefined) counts[kind] += 1;
  }
  return counts;
}
