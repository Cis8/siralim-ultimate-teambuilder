import type { FieldDefinition } from '../query/field';
import type { FieldRegistry } from '../query/field-registry';
import { fieldRegistry } from '../query/fields';
import { tokenize } from '../query/lexer';
import type { Span } from '../query/span';
import type { TermToken, Token } from '../query/token';

interface Place {
  /**
   * What an accepted suggestion takes the place of: the word the caret is in or at the end of, whole, or nothing, at the
   * caret, where no word is being typed. A negation in front of the word is a token of its own and stays.
   */
  readonly replace: Span;
}

/** A word being typed. */
interface Typed extends Place {
  /** What stands before the caret in the word, as typed: quotes taken off, the blanks inside them kept. */
  readonly prefix: string;
}

/** The value of a term whose field the registry knows. */
interface OfField extends Typed {
  readonly field: FieldDefinition;
  /** The name of the field as it was typed (`a` for `applies`, `Class`), which is how the term is written back. */
  readonly written: string;
}

/** What the caret is asking for (QUERY_LANGUAGE §6): which suggestions make sense where it stands. */
export type SuggestionContext =
  /** Between terms, after a term or a `)`: an operator may stand here, and so may a field. */
  | (Place & { readonly kind: 'operator-or-field' })
  /** Where a term starts and no operator may stand: at the start, after `(`, after an operator or a negation. */
  | (Place & { readonly kind: 'field' })
  /** A word with no field, which may become one: `we`, `"two wo`, `cla` in `class:life`, or an operator as far as typed. */
  | (Typed & {
      readonly kind: 'free';
      /** The word is an operator (`or`, `AND`, `|`), whole, though the caret may be inside it: it is not to be replaced by a term. */
      readonly operator: boolean;
    })
  /** After the colon of a field the registry knows: `class:li`. */
  | (OfField & { readonly kind: 'field-value' })
  /** After the slash in the value of a keyword field, who acts: `uses:attack/se`. */
  | (OfField & {
      readonly kind: 'actor';
      /** The key before the slash, as typed. */
      readonly key: string;
    })
  /** After the colon of a field the registry does not know. Only its name and colon are replaced, so the value stays. */
  | (Place & {
      readonly kind: 'unknown-field';
      readonly written: string;
      /** Whether a value follows the colon: mending the field then leaves a term that asks for something. */
      readonly valued: boolean;
    });

/**
 * Parentheses and the dash are tokens of their own wherever they stand, so a word is never their continuation. Anything
 * else may be: `or` may be on its way to `order`, and `|` is the start of a word (`|a` is one).
 */
const continuesAWord = ({ text }: Token): boolean => text !== '(' && text !== ')' && text !== '-';

const endsAnOperand = (token: Token | undefined): boolean => token?.kind === 'term' || token?.kind === 'close';

/**
 * Reads the query round the caret, to say what is being asked for there. The word the caret is in, or at the end of, is the
 * one being typed; at the start of a word, or between two, nothing is. Whatever stands after the caret in the word is
 * replaced too when a suggestion is accepted, as the person chooses another word for it.
 *
 * - A caret in the letters of a field's name (`cla|ss:life`) is a word that may become any field. After the colon the
 *   field decides: a known one is asked for its value, a keyword field for who acts once a slash is typed, and an unknown
 *   one for the field it was meant to be.
 * - A quote left open runs to the end of the text, as the lexer reads it, and so does the word.
 *
 * `caret` counts UTF-16 units and is kept inside the text.
 */
export function suggestionContext(
  source: string,
  caret: number,
  fields: FieldRegistry = fieldRegistry,
): SuggestionContext {
  const at = Math.min(Math.max(caret, 0), source.length);
  const tokens = tokenize(source);

  const word = tokens.find((token) => continuesAWord(token) && token.span[0] < at && at <= token.span[1]);
  if (word === undefined) {
    const previous = tokens.findLast((token) => token.span[1] <= at);
    return { kind: endsAnOperand(previous) ? 'operator-or-field' : 'field', replace: [at, at] };
  }
  if (word.kind !== 'term') {
    return { kind: 'free', replace: word.span, prefix: source.slice(word.span[0], at), operator: true };
  }
  return inTerm(word, source, at, fields);
}

function inTerm(term: TermToken, source: string, at: number, fields: FieldRegistry): SuggestionContext {
  const { field: written } = term;
  if (written === undefined) {
    return { kind: 'free', replace: term.span, prefix: typedValue(source, term, at), operator: false };
  }
  // `written.span` is the letters; the colon follows them.
  if (at <= written.span[1]) {
    return { kind: 'free', replace: term.span, prefix: source.slice(term.span[0], at), operator: false };
  }

  const field = fields.resolve(written.name);
  if (field === undefined) {
    return {
      kind: 'unknown-field',
      replace: [term.span[0], written.span[1] + 1],
      written: written.name,
      valued: term.value !== '',
    };
  }
  const typed = typedValue(source, term, at);
  const of = { replace: term.span, field, written: written.name };
  const slash = typed.lastIndexOf('/');
  if (field.values?.kind !== 'keyword' || slash < 0) return { kind: 'field-value', ...of, prefix: typed };
  return { kind: 'actor', ...of, key: typed.slice(0, slash).trim(), prefix: typed.slice(slash + 1).trim() };
}

/** The value of the term up to the caret, as typed: without the quote that opens a phrase or the one that closes it. */
function typedValue(source: string, { valueSpan: [start, end], quote }: TermToken, at: number): string {
  const written = source.slice(start, Math.min(at, end));
  if (quote === 'none') return written;
  const inside = quote === 'closed' && at >= end ? written.slice(1, -1) : written.slice(1);
  return inside.trimStart();
}
