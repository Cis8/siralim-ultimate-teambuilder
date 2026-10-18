import type { DiagnosticFix, QueryDiagnostic, SyntaxDiagnosticCode } from './diagnostic';
import { tokenize } from './lexer';
import { parseQuery, type ParseResult } from './parser';
import { serialise } from './serialise';
import type { Span } from './span';
import { applyEdit, type TextEdit } from './text-edit';
import type { Token } from './token';

/** What a fix may look at: the text, how it was read, and all that was reported about it. */
interface FixContext {
  readonly source: string;
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly QueryDiagnostic<SyntaxDiagnosticCode>[];
  readonly diagnostic: QueryDiagnostic<SyntaxDiagnosticCode>;
}

type SyntaxFix = (context: FixContext) => DiagnosticFix | undefined;

/** The text a diagnostic points at, as written. */
const faultOf = ({ source, diagnostic }: FixContext): string => source.slice(...diagnostic.span);

/** Takes the text at fault out of the query: the parser already reads it as if it were not there. */
const removeFault =
  (label?: string): SyntaxFix =>
  (context) => ({
    label: label ?? `Remove “${faultOf(context)}”`,
    edit: removal(context.source, context.tokens, context.diagnostic.span),
  });

const insertAtEnd = (source: string, text: string): TextEdit => ({ span: [source.length, source.length], text });

/** Whether the group opened at the diagnostic has a term in it: it is open, so it runs to the end of the text. */
const holdsTerm = ({ tokens, diagnostic }: FixContext): boolean =>
  tokens.some((token) => token.kind === 'term' && token.span[0] >= diagnostic.span[1]);

/** A ")" at the end closes the innermost group still open, so it mends this one only when no other is open inside it. */
function closeGroup({ source, diagnostics, diagnostic }: FixContext): DiagnosticFix | undefined {
  const waits = diagnostics.some(({ code, span }) => code === 'unclosed-open' && span[0] > diagnostic.span[0]);
  return waits ? undefined : { label: 'Add the missing “)”', edit: insertAtEnd(source, ')') };
}

/**
 * One fix per code, so that a code the parser learns to report cannot be left without a say (the type checks it). Each
 * is the edit that puts into the text the repair the parser had made, so none needs the parser to change.
 */
const SYNTAX_FIXES: Readonly<Record<SyntaxDiagnosticCode, SyntaxFix>> = {
  'unmatched-close': removeFault(),
  'dangling-operator': removeFault(),
  'missing-operand': removeFault(),
  'nested-too-deeply': removeFault(),
  'empty-group': removeFault('Remove the empty group'),
  'unclosed-quote': ({ source }) => ({ label: 'Close the quote', edit: insertAtEnd(source, '"') }),
  // A group with nothing in it is not closed into an empty "()", which is an error of its own: the "(" goes.
  'unclosed-open': (context) => (holdsTerm(context) ? closeGroup(context) : removeFault()(context)),
};

/**
 * Past this many problems a text gets no fixes: each one reads the whole text again, so the work grows with the square
 * of its size, and a pasted link can carry thousands of them (8,000 stray parentheses took twenty seconds).
 */
export const MAX_FIXABLE_DIAGNOSTICS = 50;

/**
 * The diagnostics of a parsed query, each with the one edit that mends it (`fix`), if there is one. The text outside
 * the edit stays as typed, and after it the query means what it meant: the repair the parser had made is now in the
 * text. A fix that would change the meaning is not given until the one it depends on is applied: with `- AND a` read
 * as `a`, removing the `AND` alone would hand `a` to the `-`, and a `)` added after a quote left open (it runs to the
 * end of the text) would end up inside it. For a text with up to `MAX_FIXABLE_DIAGNOSTICS` problems, fixing the first
 * diagnostic that has a fix, again and again, ends with none left.
 */
export function withSyntaxFixes(source: string, parsed: ParseResult): QueryDiagnostic<SyntaxDiagnosticCode>[] {
  const { tokens, diagnostics } = parsed;
  if (diagnostics.length > MAX_FIXABLE_DIAGNOSTICS) return [...diagnostics];
  const meaning = serialise(parsed.ast);
  const keepsMeaning = ({ edit }: DiagnosticFix): boolean =>
    serialise(parseQuery(applyEdit(source, edit)).ast) === meaning;

  return diagnostics.map((diagnostic) => {
    const fix = SYNTAX_FIXES[diagnostic.code]({ source, tokens, diagnostics, diagnostic });
    return fix !== undefined && keepsMeaning(fix) ? { ...diagnostic, fix } : diagnostic;
  });
}

/**
 * The edit that takes `span` out of the text, and with it the blanks that stood after it, or before it if it ends the
 * text or a group and none stood after, so that the two sides do not end up a blank apart too many (`a OR b` without
 * `OR` is `a b`, `(a OR)` is `(a)`, `b -() c` without `-` is `b () c`). When that would run two words into one (`a)b`
 * without `)`), the blanks stay, and failing that a space takes its place.
 */
function removal(source: string, tokens: readonly Token[], span: Span): TextEdit {
  const [start, end] = span;
  const before = source.slice(0, start);
  const blanksAfter = source.length - end - source.slice(end).trimStart().length;
  const blanksBefore = before.length - before.trimEnd().length;
  const endsHere = end === source.length || source[end] === ')';
  const removing = (from: number, to: number): TextEdit => ({ span: [from, to], text: '' });

  const candidates = [
    ...(blanksAfter > 0 ? [removing(start, end + blanksAfter)] : []),
    ...(blanksAfter === 0 && endsHere && blanksBefore > 0 ? [removing(start - blanksBefore, end)] : []),
    removing(start, end),
  ];
  const kept = tokens.filter((token) => token.span[0] < start || token.span[1] > end).map(({ text }) => text);
  const keepsTokens = (edit: TextEdit): boolean => {
    const read = tokenize(applyEdit(source, edit)).map(({ text }) => text);
    return read.length === kept.length && read.every((text, at) => text === kept[at]);
  };
  // A blank always keeps the two sides apart, so the last resort cannot fail.
  return candidates.find(keepsTokens) ?? { span, text: ' ' };
}
