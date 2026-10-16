import type { AndNode, NotNode, OrNode, QueryNode, TermNode } from './ast';

/**
 * What to do with each kind of node, given what was worked out for its operands. Evaluating, highlighting and
 * serialising a query are each a visitor; the tree and the other visitors do not change.
 */
export interface QueryVisitor<Result> {
  term(node: TermNode): Result;
  not(node: NotNode, operand: Result): Result;
  /** `operands` are in the order of the query. */
  and(node: AndNode, operands: readonly Result[]): Result;
  /** `operands` are in the order of the query. */
  or(node: OrNode, operands: readonly Result[]): Result;
}

/** Walks the tree from the terms up. The parser keeps the tree shallow (`MAX_NESTING`), so the recursion is bounded. */
export function visitQuery<Result>(node: QueryNode, visitor: QueryVisitor<Result>): Result {
  switch (node.kind) {
    case 'term':
      return visitor.term(node);
    case 'not':
      return visitor.not(node, visitQuery(node.operand, visitor));
    case 'and':
      return visitor.and(
        node,
        node.operands.map((operand) => visitQuery(operand, visitor)),
      );
    case 'or':
      return visitor.or(
        node,
        node.operands.map((operand) => visitQuery(operand, visitor)),
      );
  }
}
