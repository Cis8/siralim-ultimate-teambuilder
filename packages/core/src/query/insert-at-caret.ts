import { tokenize } from './lexer';
import type { Span } from './span';
import type { TextEdit } from './text-edit';

/** What a button of the syntax toolbar writes (QUERY_LANGUAGE §8), in the order the toolbar lists them. */
export const SYNTAX_INSERTION_IDS = [
  'open-group',
  'close-group',
  'quote',
  'or',
  'and',
  'not',
  'applies',
  'uses',
  'class',
  'material',
] as const;

export type SyntaxInsertionId = (typeof SYNTAX_INSERTION_IDS)[number];

/**
 * Where a blank goes in front of what is written. A blank or the start of the text leaves room for anything.
 * - `word`: after anything but a blank, an opening parenthesis or a negation, which the word would run into.
 * - `value`: the same, and a colon leaves room too, for a quote that opens the value of a field.
 * - `none`: never, as a parenthesis that closes a group.
 */
type Lead = 'word' | 'value' | 'none';

interface SyntaxInsertion {
  readonly text: string;
  readonly lead: Lead;
  /** A blank follows it (unless one does already), so that the next word starts from there. */
  readonly finished: boolean;
}

const INSERTIONS: Readonly<Record<SyntaxInsertionId, SyntaxInsertion>> = {
  'open-group': { text: '(', lead: 'word', finished: false },
  'close-group': { text: ')', lead: 'none', finished: false },
  quote: { text: '"', lead: 'value', finished: false },
  or: { text: 'OR', lead: 'word', finished: true },
  and: { text: 'AND', lead: 'word', finished: true },
  // The dash is the negation of the next term, and so has nothing after it.
  not: { text: '-', lead: 'word', finished: false },
  applies: { text: 'applies:', lead: 'word', finished: false },
  uses: { text: 'uses:', lead: 'word', finished: false },
  class: { text: 'class:', lead: 'word', finished: false },
  material: { text: 'mat:yes', lead: 'word', finished: true },
};

/** What may stand right in front of a word without running into it, besides a blank and the start of the text. */
const LEAVES_ROOM: Readonly<Record<Exclude<Lead, 'none'>, string>> = { word: '(-', value: '(-:' };

const BLANK = /\s/u;

export interface InsertedSyntax {
  /** The edit to make: it takes the place of the selection. */
  readonly edit: TextEdit;
  /** Where the caret goes once it is made, in the new text: where the person goes on typing. */
  readonly caret: number;
}

/** Whether a quote typed at `caret` closes a phrase that is open: the lexer runs an open one to the end of the text. */
function insideOpenPhrase(source: string, caret: number): boolean {
  return tokenize(source).some(
    (token) => token.kind === 'term' && token.quote === 'unclosed' && caret > token.valueSpan[0],
  );
}

/**
 * The edit a button of the syntax toolbar makes (PLAN 11.5): `id` is written in the place of the selection (or at the caret, when
 * it is empty), as typing it would, with a blank where the neighbours would run into it. The text outside the selection stays as
 * typed; the selection is clamped to the text and put in order, so the call cannot fail.
 *
 * The blank **before** follows `Lead`. The blank **after** is added to an operator and a finished term (`OR`, `mat:yes`), to start
 * the next one from, unless a blank follows already; the caret then steps over that blank. A **quote** is never left alone, as the
 * prototype's lone quote was (it raised an error at once): it writes a pair with the caret between, wraps a selection, and closes a
 * phrase that is open before the caret instead of opening another. A `NOT` writes the dash of the negation (`-`).
 */
export function insertAtCaret(source: string, selection: Span, id: SyntaxInsertionId): InsertedSyntax {
  const clamp = (at: number): number => Math.min(Math.max(at, 0), source.length);
  const [first, second] = [clamp(selection[0]), clamp(selection[1])];
  const span: Span = first <= second ? [first, second] : [second, first];
  const [start, end] = span;
  const { text, lead, finished } = INSERTIONS[id];

  const before = source.charAt(start - 1);
  const room = lead === 'none' || before === '' || BLANK.test(before) || LEAVES_ROOM[lead].includes(before);
  const blank = room ? '' : ' ';

  if (id === 'quote') {
    if (start === end && insideOpenPhrase(source, start)) return { edit: { span, text }, caret: start + text.length };
    const phrase = `${text}${source.slice(start, end)}${text}`;
    // Nothing selected: the caret goes between the quotes, to type the phrase. A selection is wrapped and left behind.
    const caret = start + blank.length + (start === end ? text.length : phrase.length);
    return { edit: { span, text: blank + phrase }, caret };
  }

  const followed = BLANK.test(source.charAt(end));
  const typed = blank + text + (finished && !followed ? ' ' : '');
  // A blank that follows already is the one the next word starts after: the caret goes over it.
  return { edit: { span, text: typed }, caret: start + typed.length + (finished && followed ? 1 : 0) };
}
