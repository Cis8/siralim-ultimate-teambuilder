import { suggestionContext } from './context';
import { rankCandidates } from './rank-candidates';
import type { Suggestion } from './suggestion';
import { suggestionRegistry } from './suggestion-providers';
import type { SuggestionEnvironment, SuggestionRegistry } from './suggestion-registry';

/**
 * What the person may type at the caret (QUERY_LANGUAGE §6): the context says what the caret asks for, the provider of that
 * context offers what fits, and the ranking lists the best nine. Every suggestion says what it takes the place of, so accepting
 * one needs only the text. Never throws; `caret` counts UTF-16 units and is kept inside the text.
 *
 * `environment` is what the dataset gives to type: the same `fields`, `taxonomy` and `vocabulary` as a `LintContext`, so the
 * page can hand over the one it made for the lint.
 */
export function suggestQuery(
  source: string,
  caret: number,
  environment: SuggestionEnvironment,
  registry: SuggestionRegistry = suggestionRegistry,
): readonly Suggestion[] {
  const context = suggestionContext(source, caret, environment.fields);
  return rankCandidates(registry.candidates(context, environment)).map(({ kind, insert, detail, complete }) => ({
    kind,
    insert,
    detail,
    complete,
    replace: context.replace,
  }));
}
