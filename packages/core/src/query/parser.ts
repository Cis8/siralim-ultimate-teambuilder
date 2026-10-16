import type { QueryNode } from './ast';
import type { QueryDiagnostic, SyntaxDiagnosticCode } from './diagnostic';
import { tokenize } from './lexer';
import type { Span } from './span';
import type { SymbolToken, Token } from './token';

export interface ParseResult {
  /** `undefined` for a query with no term in it, which matches everything. */
  readonly ast: QueryNode | undefined;
  readonly tokens: readonly Token[];
  /** What had to be repaired to read the query, in the order of the query. */
  readonly diagnostics: readonly QueryDiagnostic[];
}

/**
 * How many parentheses and NOTs can hold one another. Real queries nest a few; the limit keeps the tree shallow
 * enough for the visitors to recurse over, whatever text comes in (a pasted link can carry any `q`).
 */
export const MAX_NESTING = 32;

/**
 * Reads a query. It accepts any text and never throws: whatever does not make a query is reported and read as if
 * it were not there, so the tree is the one of the query with the reported text removed.
 *
 * - a `)` that closes nothing is skipped; a `(` left open is closed at the end;
 * - an `AND` or `OR` without a term on both sides, a `NOT` with nothing to negate and `()` are dropped;
 * - past `MAX_NESTING`, a `(` or `NOT` is dropped (its `)` is then reported as closing nothing).
 *
 * A term is kept as the lexer read it. Nothing here knows what a field means: the field registry does.
 */
export function parseQuery(source: string): ParseResult {
  const tokens = tokenize(source);
  const diagnostics: QueryDiagnostic[] = [];
  let position = 0;
  let groups = 0;
  let nesting = 0;

  const report = (code: SyntaxDiagnosticCode, span: Span, message: string) =>
    diagnostics.push({ code, severity: 'error', span, message });
  const reportDangling = (operator: SymbolToken) =>
    report('dangling-operator', operator.span, `“${operator.text}” needs a term on both sides`);

  /** The next token, once any `)` that closes nothing has been reported and skipped. */
  function current(): Token | undefined {
    let token = tokens[position];
    while (groups === 0 && token?.kind === 'close') {
      report('unmatched-close', token.span, 'Unmatched “)”');
      position++;
      token = tokens[position];
    }
    return token;
  }

  /** The operands of an `operator` chain; juxtaposed terms are an `and` chain without its operators. */
  function parseChain(operator: 'and' | 'or', parseOperand: () => QueryNode | undefined): QueryNode[] {
    const operands: QueryNode[] = [];
    let waiting: SymbolToken | undefined;
    for (;;) {
      const token = current();
      if (token?.kind === operator) {
        position++;
        if (waiting !== undefined) reportDangling(waiting);
        if (operands.length === 0) reportDangling(token);
        else waiting = token;
        continue;
      }
      const before = position;
      const operand = parseOperand();
      if (operand !== undefined) {
        operands.push(operand);
        waiting = undefined;
      } else if (position === before) break;
    }
    if (waiting !== undefined) reportDangling(waiting);
    return operands;
  }

  const join = (kind: 'and' | 'or', operands: QueryNode[]): QueryNode | undefined => {
    const [first] = operands;
    const last = operands.at(-1);
    if (first === undefined || last === undefined) return undefined;
    return operands.length === 1 ? first : { kind, span: [first.span[0], last.span[1]], operands };
  };

  const parseOr = () =>
    join(
      'or',
      parseChain('or', () => join('and', parseChain('and', parseUnary))),
    );

  /** Skips the `(` and `NOT` that would nest past the limit. */
  function skipTooDeep(): void {
    for (let token = current(); nesting >= MAX_NESTING && (token?.kind === 'open' || token?.kind === 'not');) {
      report('nested-too-deeply', token.span, `Nested too deeply: “${token.text}” is ignored`);
      position++;
      token = current();
    }
  }

  function parseUnary(): QueryNode | undefined {
    skipTooDeep();
    const token = current();
    if (token?.kind === 'term') {
      position++;
      if (token.quote === 'unclosed') report('unclosed-quote', token.valueSpan, 'Unclosed quote');
      return { kind: 'term', span: token.span, term: token };
    }
    if (token?.kind === 'not') {
      position++;
      nesting++;
      const operand = parseUnary();
      nesting--;
      if (operand === undefined) {
        report('missing-operand', token.span, `“${token.text}” needs a term after it`);
        return undefined;
      }
      return { kind: 'not', span: [token.span[0], operand.span[1]], operand };
    }
    if (token?.kind === 'open') return parseGroup(token);
    return undefined;
  }

  function parseGroup(open: SymbolToken): QueryNode | undefined {
    position++;
    groups++;
    nesting++;
    const inner = parseOr();
    const close = current();
    if (close !== undefined) position++;
    nesting--;
    groups--;

    if (close === undefined) report('unclosed-open', open.span, 'Unclosed “(”');
    if (inner === undefined) {
      if (close !== undefined) report('empty-group', [open.span[0], close.span[1]], 'Nothing between “(” and “)”');
      return undefined;
    }
    return { ...inner, span: [open.span[0], close?.span[1] ?? inner.span[1]] };
  }

  const ast = parseOr();
  return { ast, tokens, diagnostics: diagnostics.sort((a, b) => a.span[0] - b.span[0]) };
}
