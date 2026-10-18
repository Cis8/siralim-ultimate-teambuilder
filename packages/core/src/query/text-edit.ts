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
