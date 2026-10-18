import { matchTier, type FitTier } from './match-tier';
import { MAX_SUGGESTIONS } from './rank-candidates';

/** An entry and the place `typed` was found at in its text. */
export interface Fit<T> {
  readonly entry: T;
  readonly tier: FitTier;
}

/**
 * The entries whose text has `typed` in it, each with the place it is at, the better places first and the order of the list
 * kept inside a place. Only the first `MAX_SUGGESTIONS` of each place are kept: the ranking lists no more than that, and writing
 * out a candidate costs far more than finding it, so a provider asks this of a long list (the 1,780 trait names) and writes
 * out only what is left. `textOf` gives the text in lower case, as `typed` is.
 */
export function bestFits<T>(entries: readonly T[], typed: string, textOf: (entry: T) => string): Fit<T>[] {
  const prefix: Fit<T>[] = [];
  const wordStart: Fit<T>[] = [];
  const substring: Fit<T>[] = [];
  const places = { prefix, 'word-start': wordStart, substring } satisfies Record<FitTier, Fit<T>[]>;

  for (const entry of entries) {
    const tier = matchTier(typed, textOf(entry));
    if (tier === undefined || places[tier].length === MAX_SUGGESTIONS) continue;
    places[tier].push({ entry, tier });
  }
  return [...prefix, ...wordStart, ...substring];
}
