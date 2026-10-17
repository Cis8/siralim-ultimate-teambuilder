import { FLAG_TERMS } from './effective-query';
import type { ExploreState } from './explore-state';
import { toggleClass, toggleKeywordFilter } from './facet-toggles';

/** A filter of the state as the term of the query it stands for (`class:life`, `uses:weak`, `stack:no`), for the chip row. */
export interface FilterChip {
  readonly field: string;
  readonly value: string;
}

interface Located {
  readonly chip: FilterChip;
  /** The state without the filter. */
  readonly without: (state: ExploreState) => ExploreState;
}

/** In the order the effective query writes them: the classes, the keywords, the flags. */
function locate(state: ExploreState): Located[] {
  return [
    ...state.classes.map((name) => ({
      chip: { field: 'class', value: name },
      without: (from: ExploreState) => toggleClass(from, name),
    })),
    ...state.keywords.map((filter) => ({
      chip: { field: filter.field, value: filter.key },
      without: (from: ExploreState) => toggleKeywordFilter(from, filter),
    })),
    ...(state.artifactEligible
      ? [{ chip: FLAG_TERMS.artifactEligible, without: (from: ExploreState) => ({ ...from, artifactEligible: false }) }]
      : []),
    ...(state.doesNotStack
      ? [{ chip: FLAG_TERMS.doesNotStack, without: (from: ExploreState) => ({ ...from, doesNotStack: false }) }]
      : []),
  ];
}

/**
 * The filters that are on, one chip each (SPEC §8.1). They come before the terms of the query bar in the chip row, as
 * they do in the effective query. A chip is named by its place in this list, so the caller asks again after each change.
 */
export function filterChips(state: ExploreState): FilterChip[] {
  return locate(state).map(({ chip }) => chip);
}

/** The state without the filter of the chip: the rest stays as it was. A chip the state does not have changes nothing. */
export function removeFilterChip(state: ExploreState, index: number): ExploreState {
  return locate(state)[index]?.without(state) ?? state;
}
