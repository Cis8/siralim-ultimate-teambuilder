import { compareText, familyWrittenForms, type KeywordHit, type Trait } from '@atlas/core';
import { SENTENCE_START } from './sentence-start';

export interface TaxonomyCandidate {
  /** As written: `Fireball`, `Mega Magic`. */
  readonly term: string;
  /** In how many traits it appears. */
  readonly traits: number;
  /** The first of them. */
  readonly example: string;
  /** Some mention follows words like "afflicted with" or "gains": it may be a buff or debuff the lists lack. */
  readonly afterStatusCue: boolean;
}

export interface CandidateOptions {
  /** Fewer traits than this and a term is not worth a look. Default 3. */
  readonly minTraits?: number;
  /** Terms already looked at and found not to be keywords (stats, classes, …). */
  readonly ignore?: ReadonlySet<string>;
}

const DEFAULT_MIN_TRAITS = 3;
const CAPITALISED_WORD = /(?<![A-Za-z])[A-Z][a-z]+(?![A-Za-z])/g;
/** Words that introduce a status: what follows may be a buff or debuff. */
const STATUS_CUE =
  /(?:\bafflicted with|\bafflicts?\b[^,.;]*?\bwith|\bgains?|\bgrants?|\balways (?:has|have)|\bbattles? with)\s+(?:an?\s+|the\s+)?$/i;

/**
 * Capitalised terms in trait descriptions that the taxonomy does not cover: material for new keywords. Words a keyword
 * already covers, sentence openers and the names of traits, creatures, families (plurals too) and materials are left
 * out, since they are names, not mechanics.
 */
export function findTaxonomyCandidates(traits: readonly Trait[], options: CandidateOptions = {}): TaxonomyCandidate[] {
  const minTraits = options.minTraits ?? DEFAULT_MIN_TRAITS;
  const names = collectNames(traits);
  const found = new Map<string, { ids: Set<string>; example: string; afterStatusCue: boolean }>();

  for (const trait of traits) {
    for (const { term, before } of termsIn(trait)) {
      if (names.has(term.toLowerCase()) || options.ignore?.has(term) === true) continue;
      const entry = found.get(term) ?? { ids: new Set<string>(), example: trait.id, afterStatusCue: false };
      entry.ids.add(trait.id);
      entry.afterStatusCue ||= STATUS_CUE.test(before);
      found.set(term, entry);
    }
  }

  return [...found]
    .filter(([, entry]) => entry.ids.size >= minTraits)
    .map(([term, entry]) => ({
      term,
      traits: entry.ids.size,
      example: entry.example,
      afterStatusCue: entry.afterStatusCue,
    }))
    .toSorted((a, b) => b.traits - a.traits || compareText(a.term, b.term));
}

/** The names of the dataset, lower-cased: whatever the descriptions call by name is not a keyword. */
function collectNames(traits: readonly Trait[]): Set<string> {
  const names = new Set<string>();
  for (const trait of traits) {
    for (const name of [trait.name, trait.creature, trait.material]) {
      if (name !== null) names.add(name.toLowerCase());
    }
    for (const form of familyWrittenForms(trait.family)) names.add(form.toLowerCase());
  }
  return names;
}

/**
 * Runs of capitalised words in the middle of a sentence that no keyword covers, with the text before each. A word that
 * opens a sentence, or that a keyword covers, ends the run in progress without joining the next one.
 */
function termsIn(trait: Trait): { term: string; before: string }[] {
  const text = trait.description;
  const runs: { start: number; end: number }[] = [];
  let current: { start: number; end: number } | undefined;

  for (const word of text.matchAll(CAPITALISED_WORD)) {
    const start = word.index;
    const end = start + word[0].length;
    if (isCovered(trait.keywords, start, end) || SENTENCE_START.test(text.slice(0, start))) {
      current = undefined;
    } else if (current !== undefined && text.slice(current.end, start) === ' ') {
      current.end = end;
    } else {
      current = { start, end };
      runs.push(current);
    }
  }

  return runs.map((run) => ({ term: text.slice(run.start, run.end), before: text.slice(0, run.start) }));
}

function isCovered(keywords: readonly KeywordHit[], start: number, end: number): boolean {
  return keywords.some((hit) => hit.span[0] <= start && end <= hit.span[1]);
}
