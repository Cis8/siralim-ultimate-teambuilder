import type { Span } from './span';
import type { TermToken } from './token';

interface NodeBase {
  /** The text the node was read from, the parentheses around it included: `(weak)` spans all six characters. */
  readonly span: Span;
}

/** A word or a phrase, with its field if it has one. The field registry decides what the field means. */
export interface TermNode extends NodeBase {
  readonly kind: 'term';
  readonly term: TermToken;
}

export interface NotNode extends NodeBase {
  readonly kind: 'not';
  readonly operand: QueryNode;
}

/** Two or more operands. A group written inside another of the same kind stays a node of its own. */
export interface AndNode extends NodeBase {
  readonly kind: 'and';
  readonly operands: readonly QueryNode[];
}

/** Two or more operands. */
export interface OrNode extends NodeBase {
  readonly kind: 'or';
  readonly operands: readonly QueryNode[];
}

export type QueryNode = TermNode | NotNode | AndNode | OrNode;
