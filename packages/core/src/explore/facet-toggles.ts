import type { ClassName } from '../model/trait';
import type { ExploreState, KeywordFilter } from './explore-state';

const lowerCase = (name: ClassName): ClassName => name.toLowerCase();

const isSameKeywordFilter = (a: KeywordFilter, b: KeywordFilter): boolean => a.field === b.field && a.key === b.key;

/** Whether the class is chosen, however the dataset spells its name (the state keeps it in lower case). */
export function hasClass(state: ExploreState, name: ClassName): boolean {
  return state.classes.includes(lowerCase(name));
}

/**
 * What a press on a class in the facet panel does (SPEC §8.1): the class is chosen, after the others, which keep the order
 * they were chosen in, or taken off if it was chosen. State in, state out, like a click on a keyword (`clickKeyword`).
 */
export function toggleClass(state: ExploreState, name: ClassName): ExploreState {
  const chosen = lowerCase(name);
  return {
    ...state,
    classes: hasClass(state, name) ? state.classes.filter((other) => other !== chosen) : [...state.classes, chosen],
  };
}

export function hasKeywordFilter(state: ExploreState, filter: KeywordFilter): boolean {
  return state.keywords.some((chosen) => isSameKeywordFilter(chosen, filter));
}

/**
 * What a press on a keyword in the facet panel does: the filter is added after the others, or taken off if it was on.
 * `applies:` and `uses:` of one keyword are two filters and both may be on: the panel does what it is told, unlike a
 * click on a keyword in a description, which jumps from one side to the other.
 */
export function toggleKeywordFilter(state: ExploreState, filter: KeywordFilter): ExploreState {
  return {
    ...state,
    keywords: hasKeywordFilter(state, filter)
      ? state.keywords.filter((chosen) => !isSameKeywordFilter(chosen, filter))
      : [...state.keywords, filter],
  };
}
