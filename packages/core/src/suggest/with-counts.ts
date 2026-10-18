import { applyEdit } from '../query/text-edit';
import { acceptSuggestion } from './accept-suggestion';
import type { Suggestion } from './suggestion';

/** A suggestion and, for a finished term, how many traits the query finds once it is accepted. */
export interface CountedSuggestion extends Suggestion {
  /** Absent for a suggestion that is not a finished term, as an operator or a bare field: nothing is searched for yet. */
  readonly count?: number;
}

/**
 * Tells each finished suggestion how many traits it would show (D18). The question for each is the query the bar holds once the
 * suggestion is accepted, the whole text with the term in its place, so that the number is what Enter would show; `count` answers
 * it, and the page makes it count within the filters (`SearchService.countMatches`). An operator and a bare field are not asked
 * about, and the order of the list and every other part of a suggestion stay as they were.
 *
 * Each count reads the whole dataset: for the nine suggestions at most that is nine searches, so a page that must not wait for
 * them calls this after it has drawn the list.
 */
export function withCounts(
  source: string,
  suggestions: readonly Suggestion[],
  count: (query: string) => number,
): CountedSuggestion[] {
  return suggestions.map((suggestion) =>
    suggestion.complete
      ? { ...suggestion, count: count(applyEdit(source, acceptSuggestion(source, suggestion))) }
      : suggestion,
  );
}
