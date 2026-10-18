/** How well what was typed fits a text, best first (QUERY_LANGUAGE §6): it begins the text, begins a word of it, is somewhere inside it. */
export type FitTier = 'prefix' | 'word-start' | 'substring';

/**
 * What a candidate is ranked by. `fallback` is not a fit: it is for what is offered whatever was typed (the typed text itself
 * as a word to look for), and comes after every candidate that fits.
 */
export type MatchTier = FitTier | 'fallback';

const FIT_TIERS: readonly FitTier[] = ['prefix', 'word-start', 'substring'];

/** Best first: the order a ranking lists the tiers in. */
export const MATCH_TIERS: readonly MatchTier[] = [...FIT_TIERS, 'fallback'];

/** A letter or a digit: what a word is made of, so that whatever else stands before a text ends the word before it. */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Where `typed` is in `text`, or `undefined` when it is not. Both are lower case, as a matcher reads them; nothing typed is
 * the start of every text.
 */
export function matchTier(typed: string, text: string): FitTier | undefined {
  if (text.startsWith(typed)) return 'prefix';
  let inside = false;
  for (let at = text.indexOf(typed); at >= 0; at = text.indexOf(typed, at + 1)) {
    if (!WORD_CHARACTER.test(text.charAt(at - 1))) return 'word-start';
    inside = true;
  }
  return inside ? 'substring' : undefined;
}

/** The best fit of any of the texts: a field is found by its name and by its aliases. */
export function bestMatchTier(typed: string, texts: readonly string[]): FitTier | undefined {
  const tiers = texts.map((text) => matchTier(typed, text));
  return FIT_TIERS.find((tier) => tiers.includes(tier));
}
