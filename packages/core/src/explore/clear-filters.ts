import type { ExploreState } from './explore-state';
import { filterChips } from './filter-chips';

/**
 * What "Clear filters" does (SPEC §8.1): the classes, the keywords and the two flags come off. The query bar, the sort and the
 * match mode stay, since they are settings of the search and not filters of it. With no filter on it gives back the very
 * state it was given, for the caller to tell that there was nothing to do.
 */
export function clearFilters(state: ExploreState): ExploreState {
  if (filterChips(state).length === 0) return state;
  return { ...state, classes: [], keywords: [], artifactEligible: false, doesNotStack: false };
}
