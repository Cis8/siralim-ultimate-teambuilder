import type { VocabularyColumn } from '../query/field';
import type { Span } from '../query/span';
import type { KeywordKind } from '../model/trait';
import type { MatchTier } from './match-tier';

/** What a suggestion is, for the badge beside it: the kind of keyword, the list a name is from, or a part of the language. */
export type SuggestionKind =
  | KeywordKind
  | 'class'
  | 'family'
  | 'creature'
  | 'trait'
  /** A value from the short list of a field (`yes`). */
  | 'value'
  | 'field'
  | 'operator'
  /** Who acts, after the slash of a keyword. */
  | 'actor'
  /** The typed text itself, as a word to look for. */
  | 'text';

/** The kind of the suggestions that come from a column of the dataset. */
export const KIND_OF_COLUMN = {
  class: 'class',
  family: 'family',
  creature: 'creature',
  name: 'trait',
} as const satisfies Record<VocabularyColumn, SuggestionKind>;

/** One thing the person may type next (QUERY_LANGUAGE §6): what is written in the place of `replace`, and what it is. */
export interface Suggestion {
  readonly kind: SuggestionKind;
  /**
   * The text that takes the place of `replace`: a term as `serialiseTerm` writes it (quoted where the lexer needs it), a bare
   * `field:`, an operator. The negation in front of the word is outside `replace`, so it is not here.
   */
  readonly insert: string;
  /** One line on what it is or what it means, for the list beside the text. */
  readonly detail: string;
  /**
   * Whether accepting it leaves a finished term, which finds some traits and so can be counted. A bare field and an operator
   * do not: the person goes on typing.
   */
  readonly complete: boolean;
  /** What accepting it takes the place of, as `suggestionContext` says; the same for every suggestion of one list. */
  readonly replace: Span;
}

/** What a provider offers: a suggestion before it is ranked and told what it replaces. */
export interface Candidate extends Omit<Suggestion, 'replace'> {
  /** How well it fits what was typed. */
  readonly tier: MatchTier;
}
