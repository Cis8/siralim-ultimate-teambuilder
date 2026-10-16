import type { Span } from './span';

interface TokenBase {
  /** The token as written. */
  readonly text: string;
  readonly span: Span;
}

/** Parentheses and the operators `AND` (`&`), `OR` (`|`) and `NOT` (`-`). */
export interface SymbolToken extends TokenBase {
  readonly kind: 'open' | 'close' | 'and' | 'or' | 'not';
}

export interface FieldName {
  /** As written, whatever the letter case: the field registry decides what it names. */
  readonly name: string;
  /** The letters only, not the colon. */
  readonly span: Span;
}

/** A word or a phrase, with the field in front of it if it has one. */
export interface TermToken extends TokenBase {
  readonly kind: 'term';
  readonly field?: FieldName;
  /** The text to look for: quotes stripped and trimmed, letter case as written. Empty for `applies:`. */
  readonly value: string;
  /** Where the value is written, quotes included; empty, right after the colon, when `field:` has no value. */
  readonly valueSpan: Span;
  /** A phrase left open runs to the end of the query. */
  readonly quote: 'none' | 'closed' | 'unclosed';
}

export type Token = SymbolToken | TermToken;
