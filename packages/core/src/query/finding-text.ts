import type { DiagnosticFix } from './diagnostic';
import { serialiseTerm } from './serialise';
import type { Span } from './span';

export const quoted = (text: string): string => `“${text}”`;

/** `a`, `a or b`, `a, b or c`. */
export const listOf = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1) ?? ''}`;

/** The button that puts `text` in place of `span`; `shown` is what it says the text is. */
export const changeTo = (span: Span, text: string, shown: string): DiagnosticFix => ({
  label: `Change to ${quoted(shown)}`,
  edit: { span, text },
});

/** `value` as the lexer needs it after `field:`: in quotes only where it must be (`Rodian Master`). */
export const writtenValue = (field: string, value: string): string =>
  serialiseTerm(field, value).slice(field.length + 1);
