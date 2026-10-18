import type { TextEdit } from '../query/text-edit';
import type { Suggestion } from './suggestion';

/** What may stand right in front of an inserted word without running into it: a blank, an opening parenthesis, a negation. */
const LEAVES_ROOM_BEFORE = /[\s(-]/u;

/** A blank, as the lexer reads one. */
const BLANK = /\s/u;

/**
 * The edit that accepting a suggestion makes (QUERY_LANGUAGE §6): `insert` takes the place of `replace`, with a blank on either
 * side where the neighbours would run into it. Apply it with `applyEdit` and place the caret with `caretAfterEdit`: a caret in
 * the word that was replaced, or at the empty span, ends after what was written, so the person goes on typing from there. Text
 * outside the span stays as it was.
 *
 * - **After** (the trailing blank): one is added, to start the next term from, unless a blank follows already (the caret then
 *   stands before it, where the word ended), the suggestion is a bare field, whose value is typed there (a word that follows it
 *   becomes that value, and so does the value of the field it mends), or a finished term stands before the `)` that closes its
 *   group. An operator is not finished: nothing can end a group with one, so it gets its blank before the `)` as well.
 * - **Before:** a blank is added where the text before the span ends in anything else than a blank, `(` or `-` (a negation):
 *   after a `)`, or a closing quote, a new word would be read as a continuation of it, or look like one.
 */
export function acceptSuggestion(source: string, { kind, insert, complete, replace }: Suggestion): TextEdit {
  const [start, end] = replace;
  const before = source.charAt(start - 1);
  const after = source.charAt(end);
  const lead = before === '' || LEAVES_ROOM_BEFORE.test(before) ? '' : ' ';
  const closesGroup = after === ')' && complete;
  const room = kind === 'field' || BLANK.test(after) || closesGroup ? '' : ' ';
  return { span: replace, text: `${lead}${insert}${room}` };
}
