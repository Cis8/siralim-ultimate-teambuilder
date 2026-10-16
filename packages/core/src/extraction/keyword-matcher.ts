import type { KeywordKey, KeywordKind } from '../model/trait';
import type { TaxonomyEntry } from '../taxonomy/entry';
import type { Taxonomy } from '../taxonomy/registry';

/** A keyword found in a text, before it is given a role. */
export interface KeywordMatch {
  readonly key: KeywordKey;
  readonly kind: KeywordKind;
  /** Half-open character range `[start, end)` in the text that was searched. */
  readonly span: readonly [start: number, end: number];
}

export interface KeywordMatcher {
  /** Every keyword in the text, in order of appearance, never overlapping. */
  match(text: string): KeywordMatch[];
}

/**
 * Finds the taxonomy's keywords in free text, as whole words (`Weak` is not in `Weakness`, `Mania` is not in
 * `Maniacs`), the longest phrase winning where phrases overlap.
 *
 * Phrases, mechanics and triggers ignore letter case. Buffs and debuffs are names: they count only when written as
 * the taxonomy writes them, so "gain Immune" is a buff and "immune to damage" is not. Any run of blanks in the text
 * matches the single space of a pattern, and curly apostrophes read as straight ones; neither moves a span.
 */
export function createKeywordMatcher(taxonomy: Taxonomy): KeywordMatcher {
  const byPattern = new Map<string, { entry: TaxonomyEntry; pattern: string }>();
  for (const entry of taxonomy.entries) {
    for (const pattern of entry.patterns) byPattern.set(pattern.toLowerCase(), { entry, pattern });
  }
  if (byPattern.size === 0) return { match: () => [] };

  // Longest first: at one position the regex takes the first alternative that fits.
  const alternatives = [...byPattern.keys()]
    .sort((a, b) => b.length - a.length)
    .map((pattern) => escapeForRegExp(pattern).replaceAll(' ', '\\s+'));
  const phrase = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu');

  return {
    match(text) {
      // Replacing one character by one character keeps every index of `text` valid.
      const straight = text.replace(/[‘’]/g, "'");
      return [...straight.matchAll(phrase)].flatMap((found) => {
        const written = found[0].replace(/\s+/g, ' ');
        const known = byPattern.get(written.toLowerCase());
        if (known === undefined || (isName(known.entry) && written !== known.pattern)) return [];
        const { entry } = known;
        return [{ key: entry.key, kind: entry.kind, span: [found.index, found.index + found[0].length] as const }];
      });
    },
  };
}

/** Buffs and debuffs are proper names, unlike the phrases around them. */
const isName = (entry: TaxonomyEntry) => entry.kind === 'buff' || entry.kind === 'debuff';

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
