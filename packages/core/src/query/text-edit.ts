import type { Span } from './span';

/** Put `text` in place of `span`: an empty span inserts, an empty text deletes. Everything outside the span stays as typed. */
export interface TextEdit {
  readonly span: Span;
  readonly text: string;
}

/** The text with the edit made. The span counts UTF-16 units, as every span of the query does. */
export function applyEdit(source: string, { span: [start, end], text }: TextEdit): string {
  return source.slice(0, start) + text + source.slice(end);
}

/**
 * Where a caret that stood at `caret` in the text stands once the edit is made. A caret before the edit stays, one after it
 * moves by what the edit added or took away (so it is in front of the same text), and one in the replaced text, or at an
 * insertion, ends after what was written, as when the person typed it. A caret at the start of replaced text stays in front.
 */
export function caretAfterEdit(caret: number, { span: [start, end], text }: TextEdit): number {
  if (caret < start || (caret === start && end > start)) return caret;
  if (caret > end) return caret + text.length - (end - start);
  return start + text.length;
}
