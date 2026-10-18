import type { KeywordKind } from '../model/trait';
import type { ColumnName, IndexedTrait } from './indexed-trait';

/** Whether a trait is what one term of a query asks for. */
export type TraitMatcher = (trait: IndexedTrait) => boolean;

/** How a value is compared with what it is looked for in: the whole of it, any part of it, or the start of it. */
export type MatchMode = 'exact' | 'substring' | 'prefix';

/**
 * Whether `value` is what `mode` looks for in `entry`: all of it, any part of it, or its start. Both are lower case,
 * as a matcher reads the column of a trait and the value of a term.
 */
export function fitsValue(mode: MatchMode, entry: string, value: string): boolean {
  switch (mode) {
    case 'exact':
      return entry === value;
    case 'substring':
      return entry.includes(value);
    case 'prefix':
      return entry.startsWith(value);
  }
}

/** The columns whose values are a list the dataset gives: the others are text (the description) or too many (the material). */
export type VocabularyColumn = Extract<ColumnName, 'class' | 'family' | 'creature' | 'name'>;

/** A value that a field takes by name, with the test it stands for. */
export interface ValueChoice {
  /** Lower case, trimmed, not empty: what the matcher is asked for. */
  readonly value: string;
  /** Other spellings of it, under the same rules (`none` for `no`). */
  readonly aliases: readonly string[];
  readonly matcher: TraitMatcher;
  /** What a term with this value asks for, in words: `has no material`. */
  readonly meaning: string;
}

/**
 * Where the values of a field come from, and how a value is compared with them (`mode`). Evaluation, lint and
 * suggestions all read this, so they cannot disagree on what a field takes.
 */
export type ValueDomain =
  /** A short list the field defines; any other value finds nothing. */
  | { readonly kind: 'choices'; readonly mode: 'exact'; readonly choices: readonly ValueChoice[] }
  /** The distinct values of one column of the dataset. */
  | { readonly kind: 'vocabulary'; readonly mode: MatchMode; readonly column: VocabularyColumn }
  /** The keys of the keywords of the taxonomy of the kinds `accepts` says yes to; an event also takes `/actor`. */
  | { readonly kind: 'keyword'; readonly mode: 'prefix'; readonly accepts: (kind: KeywordKind) => boolean };

/**
 * What `field:value` means. The registry asks for a matcher once per term, so a field reads its value (parses `yes` or
 * `no`, say) once, not once per trait.
 */
export interface FieldDefinition {
  /** Lower case letters: how the query writes it, and what a diagnostic calls it. */
  readonly name: string;
  /** Other spellings, under the same rules as the name. */
  readonly aliases: readonly string[];
  /** What the field looks for, in one line, for the person typing it. */
  readonly help: string;
  /** `value` is lower case, trimmed, quotes stripped, and not empty. */
  readonly matcher: (value: string) => TraitMatcher;
  /** The value is text looked for in the description, so the results mark it there. Not marked unless `true`. */
  readonly highlightsDescription?: boolean;
  /** Absent where the value is free text (`desc:`). */
  readonly values?: ValueDomain;
  /** The term, in words, for the explanation of a query. `value` is as for `matcher`; a value the field does not take is described too. */
  readonly describe: (value: string) => string;
}
