import { compareText, familyWrittenForms, isStatSense, type KeywordHit, type Trait } from '@atlas/core';
import { SENTENCE_START } from './sentence-start';

export interface EventCandidate {
  /** As the report shows it: lower case, numbers as `#`, a family as `<family>`. */
  readonly form: string;
  /** In how many traits it appears. */
  readonly traits: number;
  /** The first of them. */
  readonly example: string;
}

export interface EventCandidates {
  /** Conditions ("After …,", "While …,") that no keyword covers. */
  readonly clauses: EventCandidate[];
  /** The phrases around a word an event goes by ("heals", "gains 5 random buffs") that no keyword covers. */
  readonly words: EventCandidate[];
}

export interface EventCandidateOptions {
  /** Fewer traits than this and a form is not worth a look. Default 1: a new event may start in a single trait. */
  readonly minTraits?: number;
  /** Forms already looked at and found to be no event (a condition on health or on the party, …). */
  readonly ignore?: ReadonlySet<string>;
}

interface EventWord {
  readonly pattern: RegExp;
  /** The word is also the name of a stat ("50% more attack"): where the text uses it so, it is no event. */
  readonly alsoAStat?: true;
}

const DEFAULT_MIN_TRAITS = 1;

/** A condition: a sentence that opens with one of these words, up to the comma or the full stop. */
const OPENING_CLAUSE =
  /(?<=^|[.!?]\s+)(?:After|When|Whenever|If|While|At|Each time|Once|Before|Upon|As long as|Every time|For each|Until)\b[^,.]*(?=[,.])/g;
/** A stretch of a description between two marks of punctuation. */
const PHRASE = /[^,.;:!?]+/g;

/**
 * The words an event goes by in a description, in every inflection: the verbs of the census that 8b.5 made of the sheet.
 * Dealing damage, Spells, Timeline and gaining stats are not events (GAME_RULES R12), so they are not here. Adding a word
 * is adding an entry.
 */
const EVENT_WORDS: readonly EventWord[] = [
  { pattern: /\b(?:start|end) of [^.,]*?turns?\b/gi },
  { pattern: /\battack(?:s|ed|ing)?\b/gi, alsoAStat: true },
  { pattern: /\bcast(?:s|ing)?\b/gi },
  { pattern: /\bdefend(?:s|ed|ing)?\b/gi },
  { pattern: /\bprovok(?:e|es|ed|ing)\b/gi },
  { pattern: /\bdodg(?:e|es|ed|ing)\b/gi },
  { pattern: /\b(?:take|takes|taking|taken|took) (?:[\w-]+ )?damage\b/gi },
  { pattern: /\b(?:heal(?:s|ed|ing)?|recover(?:s|ed)?)\b/gi },
  { pattern: /\bkill(?:s|ed|ing)?\b/gi },
  // Not "death": it is also the class, which opens a description ("Death - Enemies …").
  { pattern: /\b(?:die|dies|died|dying|dead)\b/gi },
  { pattern: /\bresurrect(?:s|ed|ion|ing)?\b/gi },
  { pattern: /\bgains? (?:an?|any|\d+) (?:random )?buffs?\b/gi },
  { pattern: /\bafflicted with (?:an?|any|\d+) (?:random )?debuffs?\b/gi },
];

/**
 * What the taxonomy may be missing in how the descriptions talk about events: the conditions that no keyword covers and the
 * words an event goes by that no keyword covers. A word that sits in a condition is left to the condition. Both are shown as
 * the text they came from, with the numbers and the families out, so that one way of saying it is one form.
 */
export function findEventCandidates(traits: readonly Trait[], options: EventCandidateOptions = {}): EventCandidates {
  const minTraits = options.minTraits ?? DEFAULT_MIN_TRAITS;
  const toForm = createFormWriter(traits);
  const clauses: Tally = new Map();
  const words: Tally = new Map();

  for (const trait of traits) {
    const openClauses = [...trait.description.matchAll(OPENING_CLAUSE)]
      .map((clause) => ({ start: clause.index, end: clause.index + clause[0].length }))
      .filter(({ start, end }) => !isCovered(trait.keywords, start, end));
    for (const { start, end } of openClauses) tally(clauses, toForm(trait.description.slice(start, end)), trait.id);

    for (const phrase of uncoveredWordPhrases(trait, openClauses)) tally(words, toForm(phrase), trait.id);
  }

  return {
    clauses: candidatesOf(clauses, minTraits, options.ignore),
    words: candidatesOf(words, minTraits, options.ignore),
  };
}

/** The traits each form is in, and the first. */
type Tally = Map<string, { ids: Set<string>; example: string }>;

/** The phrases around the event words that no keyword covers, outside the given spans. */
function uncoveredWordPhrases(trait: Trait, skip: readonly { start: number; end: number }[]): string[] {
  const text = trait.description;
  const phrases = [...text.matchAll(PHRASE)].map((phrase) => ({
    start: phrase.index,
    end: phrase.index + phrase[0].length,
  }));
  const found = new Set<string>();

  for (const { pattern, alsoAStat } of EVENT_WORDS) {
    for (const word of text.matchAll(pattern)) {
      const start = word.index;
      const end = start + word[0].length;
      const isName = /^[A-Z]/.test(word[0]) && !SENTENCE_START.test(text.slice(0, start));
      const inClause = skip.some((span) => span.start <= start && start < span.end);
      if (isName || inClause || isCovered(trait.keywords, start, end)) continue;
      if (alsoAStat === true && isStatSense(text, start, end)) continue;

      const phrase = phrases.find((candidate) => candidate.start <= start && start < candidate.end);
      if (phrase !== undefined) found.add(text.slice(phrase.start, phrase.end));
    }
  }
  return [...found];
}

function isCovered(keywords: readonly KeywordHit[], start: number, end: number): boolean {
  return keywords.some((hit) => hit.span[0] < end && start < hit.span[1]);
}

/** Writes a piece of a description as a form: a family is `<family>`, a number `#`, and the case and the blanks go. */
function createFormWriter(traits: readonly Trait[]): (text: string) => string {
  const families = [...new Set(traits.flatMap((trait) => familyWrittenForms(trait.family)))]
    .toSorted((a, b) => b.length - a.length)
    .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Longest first, so that `Pit Worms` is one family and not `Worms` after a stray `Pit`.
  const family =
    families.length === 0 ? null : new RegExp(`(?<![\\p{L}\\p{N}])(?:${families.join('|')})(?![\\p{L}\\p{N}])`, 'gu');

  return (text) =>
    (family === null ? text : text.replace(family, '<family>'))
      .toLowerCase()
      .replace(/\d+%?/g, '#')
      .replace(/\s+/g, ' ')
      .trim();
}

function tally(found: Tally, form: string, id: string): void {
  const entry = found.get(form) ?? { ids: new Set<string>(), example: id };
  entry.ids.add(id);
  found.set(form, entry);
}

function candidatesOf(found: Tally, minTraits: number, ignore: ReadonlySet<string> | undefined): EventCandidate[] {
  return [...found]
    .filter(([form, entry]) => entry.ids.size >= minTraits && ignore?.has(form) !== true)
    .map(([form, entry]) => ({ form, traits: entry.ids.size, example: entry.example }))
    .toSorted((a, b) => b.traits - a.traits || compareText(a.form, b.form));
}
