import type { QueryNode, TermNode } from './ast';
import { tokenize } from './lexer';
import { visitQuery, type QueryVisitor } from './visitor';

/** A node as text, with the kind of node it is, so that the node above it knows whether it needs parentheses. */
interface Written {
  readonly kind: QueryNode['kind'];
  readonly text: string;
}

const inParentheses = ({ kind, text }: Written, ...around: readonly QueryNode['kind'][]): string =>
  around.includes(kind) ? `(${text})` : text;

const writer: QueryVisitor<Written> = {
  term: (node) => ({ kind: 'term', text: writeTerm(node) }),
  not: (_node, operand) => ({ kind: 'not', text: `-${inParentheses(operand, 'and', 'or')}` }),
  // A group inside a group of its own kind is a node of its own, so it keeps its parentheses; a lower operator needs them.
  and: (_node, operands) => ({
    kind: 'and',
    text: operands.map((operand) => inParentheses(operand, 'and', 'or')).join(' '),
  }),
  or: (_node, operands) => ({ kind: 'or', text: operands.map((operand) => inParentheses(operand, 'or')).join(' OR ') }),
};

/**
 * The canonical text of a query: terms with their field as written and their quotes only where the lexer needs
 * them, `-` for NOT, a space for AND, ` OR `, and parentheses only where the tree needs them. Reading it back gives the
 * tree it was written from, spans aside; a query with no term gives no text. The values are what the lexer reads, so
 * none holds a quote (a phrase cannot).
 */
export function serialise(ast: QueryNode | undefined): string {
  return ast === undefined ? '' : visitQuery(ast, writer).text;
}

/** Quotes the value unless the lexer reads the text as one term with that field and value: `and`, `-x`, `a:b`, `()`. */
function writeTerm({ term }: TermNode): string {
  const prefix = term.field === undefined ? '' : `${term.field.name}:`;
  const plain = `${prefix}${term.value}`;
  const [only, ...others] = tokenize(plain);
  const readsBack =
    only?.kind === 'term' && others.length === 0 && only.value === term.value && only.field?.name === term.field?.name;
  return readsBack ? plain : `${prefix}"${term.value}"`;
}
