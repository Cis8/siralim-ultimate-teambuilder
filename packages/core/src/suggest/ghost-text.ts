import type { Suggestion } from './suggestion';

/**
 * The rest of a suggestion that the field shows in grey after what was typed, which Tab writes (QUERY_LANGUAGE §6); empty when
 * there is nothing to show. It is shown only where it can go on from the letters: the caret is at the end of the text, so the grey
 * text stands over nothing, something was typed, and the suggestion begins with it, letter case aside (`a:VUL` goes on with
 * `nerable`, and Tab writes `a:vulnerable`). A suggestion that is another word, as `applies:weak` for `we`, the quoted name for
 * a name typed without the quote, or the field that mends a misspelt one, is no continuation of what was typed and shows none.
 *
 * `suggestion` is the one Tab would accept, the top of the list or the one the person has moved to; a caret outside the text is
 * kept inside it.
 */
export function ghostText(source: string, caret: number, suggestion: Suggestion | undefined): string {
  if (suggestion === undefined) return '';
  const at = Math.min(Math.max(caret, 0), source.length);
  const [start, end] = suggestion.replace;
  if (at < source.length || end !== at || start >= at) return '';

  const typed = source.slice(start, at);
  const { insert } = suggestion;
  return insert.toLowerCase().startsWith(typed.toLowerCase()) ? insert.slice(typed.length) : '';
}
