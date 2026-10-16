import type { Span } from './span';
import type { SymbolToken, TermToken, Token } from './token';

const PHRASE = String.raw`"[^"]*"?`;
const WORD_CHARACTER = String.raw`[^\s()"]`;

/**
 * One token per match. Blanks match nothing, and every other character starts or continues a match, so no text is
 * left out. A dash is a token of its own only where a token starts, as in `-stack:no`, never inside a word. A field
 * is letters followed by a colon, and its value may be empty, but not separated from the colon by a blank.
 */
const TOKEN = new RegExp(
  [
    String.raw`(?<paren>[()])`,
    String.raw`(?<dash>-)`,
    String.raw`(?<field>[A-Za-z]+):(?<fieldValue>${PHRASE}|${WORD_CHARACTER}*)`,
    String.raw`(?<bareValue>${PHRASE}|${WORD_CHARACTER}+)`,
  ].join('|'),
  'gu',
);

const OPERATORS: ReadonlyMap<string, SymbolToken['kind']> = new Map([
  ['and', 'and'],
  ['&', 'and'],
  ['or', 'or'],
  ['|', 'or'],
  ['not', 'not'],
]);

/**
 * Splits a query into tokens, each with the span it covers, in order. It accepts any text and never throws: a
 * quote left open or a parenthesis without its pair is for the parser to report.
 */
export function tokenize(source: string): Token[] {
  return [...source.matchAll(TOKEN)].map((found) => {
    const { paren, dash, field, fieldValue, bareValue }: Groups = found.groups ?? {};
    const start = found.index;
    const span: Span = [start, start + found[0].length];
    if (paren !== undefined) return symbol(paren === '(' ? 'open' : 'close', found[0], span);
    if (dash !== undefined) return symbol('not', found[0], span);
    if (field !== undefined) {
      const fieldSpan: Span = [start, start + field.length];
      return term(found[0], span, fieldValue ?? '', start + field.length + 1, { name: field, span: fieldSpan });
    }
    const operator =
      bareValue === undefined || bareValue.startsWith('"') ? undefined : OPERATORS.get(bareValue.toLowerCase());
    return operator === undefined ? term(found[0], span, bareValue ?? '', start) : symbol(operator, found[0], span);
  });
}

type Groups = Partial<Record<'paren' | 'dash' | 'field' | 'fieldValue' | 'bareValue', string>>;

const symbol = (kind: SymbolToken['kind'], text: string, span: Span): SymbolToken => ({ kind, text, span });

function term(text: string, span: Span, written: string, valueStart: number, field?: TermToken['field']): TermToken {
  const valueSpan: Span = [valueStart, valueStart + written.length];
  const phrase = written.startsWith('"');
  const closed = phrase && written.length > 1 && written.endsWith('"');
  const quote = !phrase ? 'none' : closed ? 'closed' : 'unclosed';
  const value = phrase ? written.slice(1, closed ? -1 : undefined).trim() : written;
  return { kind: 'term', text, span, ...(field === undefined ? {} : { field }), value, valueSpan, quote };
}
