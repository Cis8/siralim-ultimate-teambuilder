import type { KeywordActor, KeywordKey, KeywordKind } from '../model/trait';
import type { TaxonomyEntry } from '../taxonomy/entry';
import type { Taxonomy } from '../taxonomy/registry';
import { isStatSense } from './stat-sense';
import { findTurns } from './turns';

/** A keyword found in a text, before it is given a role. */
export interface KeywordMatch {
  readonly key: KeywordKey;
  readonly kind: KeywordKind;
  /** Half-open character range `[start, end)` in the text that was searched. */
  readonly span: readonly [start: number, end: number];
  /** Only for the turns: whose turn it is, when the words say so ("your Phoenixes' turns"). */
  readonly actor?: KeywordActor;
}

export interface KeywordMatcher {
  /** Every keyword in the text, in order of appearance, never overlapping. */
  match(text: string): KeywordMatch[];
}

/**
 * Finds the taxonomy's keywords in free text, as whole words (`Weak` is not in `Weakness`, `Mania` is not in
 * `Maniacs`), the longest phrase winning where phrases overlap.
 *
 * Phrases, mechanics and events ignore letter case. Buffs and debuffs are names: they count only when written as
 * the taxonomy writes them, so "gain Immune" is a buff and "immune to damage" is not, and not when a capitalised
 * word follows, which makes them part of a name ("Savage Spores"). Any run of blanks in the text
 * matches the single space of a pattern, and curly apostrophes read as straight ones; neither moves a span.
 *
 * The edges of a turn are not patterns but a grammar (`findTurns`), since whose turn it is can be a family. A word an
 * event shares with a stat ("50% more attack") is the event only where the words around it do not say stat (`isStatSense`).
 * An event is written in lower case unless it starts a sentence: "Death creatures", "Major Healing" and "Kill Streak" are
 * a class and two spells.
 */
export function createKeywordMatcher(taxonomy: Taxonomy): KeywordMatcher {
  const byPattern = new Map<string, { entry: TaxonomyEntry; pattern: string }>();
  for (const entry of taxonomy.entries) {
    for (const pattern of entry.patterns) byPattern.set(pattern.toLowerCase(), { entry, pattern });
  }
  const statWords = new Set(
    taxonomy.ofKind('event').flatMap((entry) => (entry.statPatterns ?? []).map((word) => word.toLowerCase())),
  );
  const turnKeys = new Map(
    taxonomy
      .ofKind('event')
      .flatMap((entry) => (entry.turnEdge === undefined ? [] : [[entry.turnEdge, entry.key] as const])),
  );
  if (byPattern.size === 0 && turnKeys.size === 0) return { match: () => [] };

  // Longest first: at one position the regex takes the first alternative that fits.
  const alternatives = [...byPattern.keys()]
    .sort((a, b) => b.length - a.length)
    .map((pattern) => escapeForRegExp(pattern).replaceAll(' ', '\\s+'));
  const phrase =
    alternatives.length === 0
      ? undefined
      : new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu');

  return {
    match(text) {
      // Replacing one character by one character keeps every index of `text` valid.
      const straight = text.replace(/[‘’]/g, "'");
      const phrases = [...(phrase === undefined ? [] : straight.matchAll(phrase))].flatMap((found) => {
        const written = found[0].replace(/\s+/g, ' ');
        const known = byPattern.get(written.toLowerCase());
        if (known === undefined) return [];
        if (
          isStatusName(known.entry) &&
          (written !== known.pattern || continuesIntoName(straight, found.index + found[0].length))
        ) {
          return [];
        }
        if (known.entry.kind === 'event' && isNameInSentence(straight, found.index, found.index + found[0].length)) {
          return [];
        }
        const end = found.index + found[0].length;
        if (statWords.has(written.toLowerCase()) && isStatSense(straight, found.index, end)) return [];
        const { entry } = known;
        return [{ key: entry.key, kind: entry.kind, span: [found.index, end] as const }];
      });
      const turns = findTurns(straight).flatMap(({ edge, span, actor }) => {
        const key = turnKeys.get(edge);
        return key === undefined
          ? []
          : [{ key, kind: 'event' as const, span, ...(actor === undefined ? {} : { actor }) }];
      });
      return withoutOverlaps([...phrases, ...shortenedBefore(turns, phrases, straight)]);
    },
  };
}

/**
 * The turns, each cut short where a phrase starts inside it ("each Cursed enemy's turn" names a debuff), and dropped
 * when nothing of it is left. The phrase is a mention of its own and keeps its words.
 */
function shortenedBefore(
  turns: readonly KeywordMatch[],
  phrases: readonly KeywordMatch[],
  text: string,
): KeywordMatch[] {
  return turns.flatMap((turn) => {
    const inside = phrases.find(({ span }) => span[0] < turn.span[1] && turn.span[0] < span[1]);
    if (inside === undefined) return [turn];
    const kept = text.slice(turn.span[0], inside.span[0]).trimEnd();
    return kept === '' ? [] : [{ ...turn, span: [turn.span[0], turn.span[0] + kept.length] as const }];
  });
}

/** In order of appearance; where two overlap the one that starts first stays, and the longer one if they start together. */
function withoutOverlaps(matches: readonly KeywordMatch[]): KeywordMatch[] {
  const ordered = matches.toSorted((a, b) => a.span[0] - b.span[0] || b.span[1] - a.span[1]);
  const kept: KeywordMatch[] = [];
  for (const match of ordered) {
    const last = kept.at(-1);
    if (last === undefined || last.span[1] <= match.span[0]) kept.push(match);
  }
  return kept;
}

/** A capitalised word right after: the status is the start of a longer name, as in "Savage Spores". */
const continuesIntoName = (text: string, position: number) => /^ [A-Z][a-z]/.test(text.slice(position, position + 3));

/** Buffs and debuffs are proper names, unlike the phrases around them. */
const isStatusName = (entry: TaxonomyEntry) => entry.kind === 'buff' || entry.kind === 'debuff';

/** A capital letter in the middle of a sentence: the word is a name, whatever else it spells. */
function isNameInSentence(text: string, position: number, end: number): boolean {
  if (!/^\p{Lu}/u.test(text.slice(position, position + 1))) return false;
  // "Death - Enemies are afflicted": a label of a list, whatever follows it. After a dash a word starts anew.
  if (/^\s+[-–—]\s/.test(text.slice(end, end + 4))) return true;
  return !/(?:^|[.!?]\s+|[-–—]\s+|["(]\s*)$/.test(text.slice(0, position));
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
