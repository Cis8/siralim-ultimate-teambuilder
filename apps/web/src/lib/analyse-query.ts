import {
  createLintContext,
  lintQuery,
  suggestQuery,
  withCounts,
  type CountedSuggestion,
  type ExploreState,
  type LintContext,
  type QueryDiagnostic,
  type SearchService,
} from '@atlas/core';
import type { ComboboxOption } from './combobox-option';
import { suggestionOption } from './suggestion-option';

/** What the query assist knows about the text of the search field: what is wrong with it, and what may be typed at the caret. */
export interface QueryAnalysis {
  readonly issues: readonly QueryDiagnostic[];
  /** What may be typed at the caret. Only the first is counted: `countNext` counts the others once the list is drawn. */
  readonly suggestions: readonly CountedSuggestion[];
}

/** The lint context of a dataset remembers the counts it has asked for, so a service has the one: a keystroke leaves most terms as they were. */
const contexts = new WeakMap<SearchService, LintContext>();

function contextOf(service: SearchService): LintContext {
  let context = contexts.get(service);
  if (context === undefined) {
    context = createLintContext(service);
    contexts.set(service, context);
  }
  return context;
}

/** How many traits a query finds among those the filters leave (D18): what Enter would show for it. */
const countWithin =
  (service: SearchService, filters: ExploreState) =>
  (query: string): number =>
    service.countMatches(filters, query);

/**
 * What the assist works out for a keystroke before anything is drawn (ADR-0010): the issues of `source` (QUERY_LANGUAGE §5) and the
 * suggestions at `caret` (§6). `caret` is where the person is typing; none (the field has not the focus, or a part of the text is
 * selected) judges every term as it stands and suggests nothing.
 *
 * The first suggestion is counted here and the rest are not. Each count is a search, and nine of them hold a keystroke up past the
 * 16 ms of its budget on a slow phone, so the list is drawn first and `countNext` follows, a few at a time. The first is the one that is
 * active as the person types, which a screen reader reads at once, so it is not left for later.
 */
export function analyseQuery(
  service: SearchService,
  filters: ExploreState,
  source: string,
  caret: number | undefined,
): QueryAnalysis {
  const issues = lintQuery(source, contextOf(service), caret === undefined ? {} : { caret });
  const found = caret === undefined ? [] : suggestQuery(source, caret, contextOf(service));
  return { issues, suggestions: countFirst(source, found, countWithin(service, filters)) };
}

function countFirst(
  source: string,
  suggestions: readonly CountedSuggestion[],
  count: (query: string) => number,
): readonly CountedSuggestion[] {
  const [first, ...rest] = suggestions;
  return first === undefined ? [] : [...withCounts(source, [first], count), ...rest];
}

/** A finished term that has not been counted yet. */
const isUncounted = ({ complete, count }: CountedSuggestion): boolean => complete && count === undefined;

/** Whether `countNext` has anything left to do for the list. */
export const hasUncounted = (suggestions: readonly CountedSuggestion[]): boolean => suggestions.some(isUncounted);

/** How many suggestions `countNext` counts in a step: the work of a step is a few searches, which a phone does between two frames. */
export const COUNTS_PER_STEP = 3;

/**
 * The same suggestions with the next ones counted: up to `limit` of those that are finished terms and have no count yet, in the order
 * of the list. The list is counted in steps, each in a task of its own, so that no task is more than a few searches (ADR-0010). The
 * array that was given comes back when nothing is left to count.
 */
export function countNext(
  service: SearchService,
  filters: ExploreState,
  source: string,
  suggestions: readonly CountedSuggestion[],
  limit: number = COUNTS_PER_STEP,
): readonly CountedSuggestion[] {
  const chosen = new Set(suggestions.filter(isUncounted).slice(0, limit));
  if (chosen.size === 0) return suggestions;
  const count = countWithin(service, filters);
  return suggestions.map((suggestion) => {
    if (!chosen.has(suggestion)) return suggestion;
    const [counted = suggestion] = withCounts(source, [suggestion], count);
    return counted;
  });
}

/** The rows of the list that suggestions are: the same number, in the same order. */
export function optionsOf(suggestions: readonly CountedSuggestion[]): readonly ComboboxOption[] {
  return suggestions.map(suggestionOption);
}
