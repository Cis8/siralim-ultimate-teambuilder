import type { AndNode, NotNode, OrNode, QueryNode, TermNode } from './ast';
import { tokenize } from './lexer';
import { parseQuery } from './parser';
import type { Span } from './span';
import type { Token } from './token';
import { visitQuery, type QueryVisitor } from './visitor';

/** A term of the query, as the chip row shows it. */
export interface QueryChip {
  /** As written, whatever the letter case; `undefined` for a word with no field. */
  readonly field: string | undefined;
  /** What the term looks for: quotes stripped, letter case as written. Empty for `applies:`. */
  readonly value: string;
  /** A trait found has not got the term: there is an odd number of NOTs above it. */
  readonly negated: boolean;
}

type Operator = NotNode | AndNode | OrNode;

/** A term and the operators above it, from the root of the query down. */
interface Located {
  readonly node: TermNode;
  readonly above: readonly Operator[];
}

const below =
  (operator: Operator) =>
  ({ node, above }: Located): Located => ({ node, above: [operator, ...above] });

const locator: QueryVisitor<readonly Located[]> = {
  term: (node) => [{ node, above: [] }],
  not: (node, operand) => operand.map(below(node)),
  and: (node, operands) => operands.flat().map(below(node)),
  or: (node, operands) => operands.flat().map(below(node)),
};

function read(source: string) {
  const { ast, tokens } = parseQuery(source);
  return { tokens, found: ast === undefined ? [] : visitQuery(ast, locator) };
}

const chipOf = ({ node, above }: Located): QueryChip => ({
  field: node.term.field?.name,
  value: node.term.value,
  negated: above.filter((operator) => operator.kind === 'not').length % 2 === 1,
});

/**
 * The terms of a query, in the order of the text: one chip each. The operations below name a chip by its place in this
 * list, so the caller asks again after every change to the text. A term in a group is a chip like any other, and a
 * term under a NOT is `negated` whatever stands between them (`-(a OR b)` has two negated chips).
 */
export function queryChips(source: string): QueryChip[] {
  return read(source).found.map(chipOf);
}

/**
 * The query with the chip excluded if it was included and included if it was excluded, and the rest of the text as it
 * was. A NOT written in front of the term is taken away (`-`, `NOT`, and the blank after it); otherwise a `-` is
 * written in front of the term, inside the parentheses it may have, so `-(a OR b)` flips `a` with `-(-a OR b)`: the
 * meaning of the others does not change. A chip the query does not have, or a flip the parser would not read (a NOT
 * nested past `MAX_NESTING`), leaves the text as it is.
 */
export function toggleChipNot(source: string, index: number): string {
  const { tokens, found } = read(source);
  const target = found[index];
  if (target === undefined) return source;

  const parent = target.above.at(-1);
  const toggled =
    parent?.kind === 'not'
      ? withoutTokens(source, tokens, isSymbolOf(parent, tokens))
      : withNotBefore(source, target.node.term.span[0]);
  return queryChips(toggled)[index]?.negated === !chipOf(target).negated ? toggled : source;
}

/** Picks out the NOT symbol of a node: the last one before its operand (the node itself may start at a parenthesis). */
function isSymbolOf(node: NotNode, tokens: readonly Token[]): (token: Token) => boolean {
  const symbol = tokens.findLast((token) => token.kind === 'not' && token.span[1] <= node.operand.span[0]);
  return (token) => token === symbol;
}

/** A `-` in front of the term at `start`, set apart by a blank if a word ends there (`a -"b"`, not `a-"b"`). */
function withNotBefore(source: string, start: number): string {
  const before = source[start - 1];
  const apart = before !== undefined && !/[\s()]/u.test(before);
  return `${source.slice(0, start)}${apart ? ' ' : ''}-${source.slice(start)}`;
}

/**
 * The query without the chip: its term, the NOTs written right in front of it, and the operator that joined it to the
 * term next to it (the one before it, for the last term of a group). The rest of the text stays as typed. A group left
 * with one plain term is that term, so its parentheses go too; the only term of a query leaves no query at all, which
 * is no text. A chip the query does not have leaves the text as it is.
 */
export function removeChip(source: string, index: number): string {
  const { tokens, found } = read(source);
  const target = found[index];
  if (target === undefined) return source;

  const { unit, group } = removable(target);
  if (group === undefined) return '';

  const rest = group.operands.filter((operand) => operand !== unit);
  const [only] = rest;
  // A group left with one plain term is that term: its parentheses and operators go as well.
  if (rest.length === 1 && only?.kind === 'term') {
    return withoutTokens(source, tokens, (token) => within(token, group.span) && !within(token, only.span));
  }
  const goes = withOperator(group.operands, unit);
  return withoutTokens(source, tokens, (token) => within(token, goes));
}

/** What goes with a chip: the term and the NOTs above it, one node, and the AND or OR group it is an operand of. */
function removable({ node, above }: Located): { unit: QueryNode; group: AndNode | OrNode | undefined } {
  let unit: QueryNode = node;
  for (const operator of above.toReversed()) {
    if (operator.kind !== 'not') return { unit, group: operator };
    unit = operator;
  }
  return { unit, group: undefined };
}

/** An operand and the operator next to it: up to the next operand, or from the one before if it is the last. */
function withOperator(operands: readonly QueryNode[], unit: QueryNode): Span {
  const at = operands.indexOf(unit);
  const next = operands[at + 1];
  if (next !== undefined) return [unit.span[0], next.span[0]];
  return [operands[at - 1]?.span[1] ?? unit.span[0], unit.span[1]];
}

const within = (token: Token, [start, end]: Span): boolean => token.span[0] >= start && token.span[1] <= end;

/**
 * The text without the tokens that `isDropped` says so of. Two tokens that stay get the blank that stood next to what
 * went, none if they were not apart there and the first is a `(` or `-` or the second a `)`, which stick to what is
 * next to them (`(a OR b OR c)` without `OR c` is `(a OR b)`, `( a OR b OR c )` is `( a OR b )`, `-(a b)` without `a`
 * is `-b`). With no blank on either side they stay as close as they read as two tokens, and are apart by a space
 * otherwise (`a(b)c` without `(b)` is `a c`, `NOT(a b)` without `a` is `NOT b`).
 */
function withoutTokens(source: string, tokens: readonly Token[], isDropped: (token: Token) => boolean): string {
  const gaps = tokens.map((token, at) => source.slice(tokens[at - 1]?.span[1] ?? 0, token.span[0]));
  const kept = tokens.flatMap((token, at) => (isDropped(token) ? [] : [{ token, at }]));
  const leading = source.slice(0, tokens[0]?.span[0] ?? source.length);
  const trailing = source.slice(tokens.at(-1)?.span[1] ?? source.length);

  const body = kept.map(({ token, at }, n) => {
    const previous = kept[n - 1];
    if (previous === undefined) return token.text;
    const blanks = [gaps[previous.at + 1] ?? '', gaps[at] ?? ''];
    const tight = (sticksToNext(previous.token) || token.kind === 'close') && blanks.includes('');
    const gap = tight ? '' : (blanks.find(Boolean) ?? (readAsTwo(previous.token, token) ? '' : ' '));
    return gap + token.text;
  });
  return leading + body.join('') + trailing;
}

/** `(` and the `-` of a NOT belong with what follows them; `NOT` does not, it is a word. */
const sticksToNext = ({ kind, text }: Token): boolean => kind === 'open' || (kind === 'not' && text === '-');

/** Whether two tokens written one after the other are still two tokens, these ones. */
function readAsTwo(left: Token, right: Token): boolean {
  const [first, second, ...others] = tokenize(left.text + right.text);
  return others.length === 0 && first?.text === left.text && second?.text === right.text;
}
