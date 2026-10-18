import type { FieldRegistry } from '../query/field-registry';
import type { QueryVocabulary } from '../query/query-vocabulary';
import type { Taxonomy } from '../taxonomy/registry';
import type { SuggestionContext } from './context';
import type { Candidate } from './suggestion';

/** What a provider may ask besides the context: the language, the keywords and the dataset the query is written for. */
export interface SuggestionEnvironment {
  readonly fields: FieldRegistry;
  readonly taxonomy: Taxonomy;
  readonly vocabulary: QueryVocabulary;
}

export type ContextKind = SuggestionContext['kind'];

/** The contexts of one kind: what a provider that answers it is given. */
export type ContextOf<K extends ContextKind> = Extract<SuggestionContext, { readonly kind: K }>;

/** Offers what makes sense where the caret stands, for one kind of context (QUERY_LANGUAGE §6). Made by `suggestionProvider`. */
export interface SuggestionProvider {
  /** The kind of context it answers. One provider to a kind. */
  readonly kind: ContextKind;
  /**
   * Everything that fits the context, each candidate with how well it fits what was typed. Not ranked, not cut and perhaps
   * with repeats: the ranking does that for every provider alike. Nothing for a context of another kind.
   */
  suggest(context: SuggestionContext, environment: SuggestionEnvironment): readonly Candidate[];
}

function isContextOf<K extends ContextKind>(kind: K, context: SuggestionContext): context is ContextOf<K> {
  return context.kind === kind;
}

/** A provider for the contexts of one kind, which `suggest` is given as that kind and not as any of them. */
export function suggestionProvider<K extends ContextKind>(
  kind: K,
  suggest: (context: ContextOf<K>, environment: SuggestionEnvironment) => readonly Candidate[],
): SuggestionProvider {
  return { kind, suggest: (context, environment) => (isContextOf(kind, context) ? suggest(context, environment) : []) };
}

/** The providers break a rule that would make two of them answer the same context. */
export class SuggestionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuggestionRegistryError';
  }
}

export interface SuggestionRegistry {
  /** In the order they were given. */
  readonly providers: readonly SuggestionProvider[];
  /** What the provider of the kind of the context offers, and nothing when no provider answers that kind. */
  candidates(context: SuggestionContext, environment: SuggestionEnvironment): readonly Candidate[];
}

/**
 * Checks the providers and wraps them. A new context is a new kind in `SuggestionContext` and a provider for it; the ranking and
 * `suggestQuery` do not change.
 *
 * @throws SuggestionRegistryError listing every kind that two providers answer.
 */
export function createSuggestionRegistry(providers: readonly SuggestionProvider[]): SuggestionRegistry {
  const counts = new Map<ContextKind, number>();
  for (const { kind } of providers) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const violations = [...counts]
    .filter(([, count]) => count > 1)
    .map(([kind, count]) => `the context "${kind}" is answered by ${count} providers`);
  if (violations.length > 0) {
    throw new SuggestionRegistryError(`The suggestion providers are not valid:\n- ${violations.join('\n- ')}`);
  }

  const byKind = new Map(providers.map((provider) => [provider.kind, provider]));
  return {
    providers,
    candidates: (context, environment) => byKind.get(context.kind)?.suggest(context, environment) ?? [],
  };
}
