import type { Trait } from '../model/trait';
import type { QueryNode } from './ast';
import type { TraitMatcher } from './field';
import type { FieldRegistry } from './field-registry';
import { fieldRegistry } from './fields';
import type { TraitIndex } from './trait-index';
import { visitQuery, type QueryVisitor } from './visitor';

/** Turns the query into one test on a trait. The field of a term is asked for its matcher here, once per term. */
const compiler = (registry: FieldRegistry): QueryVisitor<TraitMatcher> => ({
  term: ({ term }) => registry.matcherFor(term),
  not: (_node, operand) => (trait) => !operand(trait),
  and: (_node, operands) => (trait) => operands.every((operand) => operand(trait)),
  or: (_node, operands) => (trait) => operands.some((operand) => operand(trait)),
});

/**
 * The traits the query finds, in the order of the index. A query with no term (`ast` is `undefined`) finds them all.
 * The fields are read from `registry`, which is the one of the app unless a test brings its own.
 */
export function evaluate(
  ast: QueryNode | undefined,
  index: TraitIndex,
  registry: FieldRegistry = fieldRegistry,
): readonly Trait[] {
  const entries = ast === undefined ? index.entries : index.entries.filter(visitQuery(ast, compiler(registry)));
  return entries.map(({ trait }) => trait);
}
