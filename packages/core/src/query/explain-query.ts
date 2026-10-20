import type { QueryNode } from './ast';
import type { FieldRegistry } from './field-registry';
import { fieldRegistry } from './fields';
import { visitQuery, type QueryVisitor } from './visitor';

/** A node in words, with the kind of node it is, so that the node above it knows whether it needs parentheses. */
interface Said {
  readonly kind: QueryNode['kind'];
  readonly words: string;
}

const inParentheses = ({ kind, words }: Said, ...around: readonly QueryNode['kind'][]): string =>
  around.includes(kind) ? `(${words})` : words;

const explainer = (registry: FieldRegistry): QueryVisitor<Said> => ({
  term: ({ term }) => ({ kind: 'term', words: registry.describeTerm(term) }),
  not: (_node, operand) => ({ kind: 'not', words: `NOT ${inParentheses(operand, 'and', 'or')}` }),
  // A group inside a group of its own kind says the same as the operands side by side, so it is not set apart; only a
  // lower operator inside a higher one needs parentheses (NOT > AND > OR).
  and: (_node, operands) => ({
    kind: 'and',
    words: operands.map((operand) => inParentheses(operand, 'or')).join(' AND '),
  }),
  or: (_node, operands) => ({ kind: 'or', words: operands.map(({ words }) => words).join(' OR ') }),
});

/**
 * A query as plain language, for the line that says how the search reads it (QUERY_LANGUAGE §7): each term in the words
 * of its field, `AND`, `OR` and `NOT` between them, and parentheses only where precedence needs them. A query with no term
 * finds every trait. The fields are read from `registry`, which is the one of the app unless a test brings its own.
 */
export function explainQuery(ast: QueryNode | undefined, registry: FieldRegistry = fieldRegistry): string {
  return ast === undefined ? 'every trait' : visitQuery(ast, explainer(registry)).words;
}
