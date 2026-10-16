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

const matchEveryTrait: TraitMatcher = () => true;

/**
 * The test a query is on one trait: what `evaluate` runs on the index, for a caller that asks it of more than one set of
 * traits. A query with no term (`ast` is `undefined`) accepts every trait. The fields are read from `registry`, which is
 * the one of the app unless a test brings its own.
 */
export function compileQuery(ast: QueryNode | undefined, registry: FieldRegistry = fieldRegistry): TraitMatcher {
  return ast === undefined ? matchEveryTrait : visitQuery(ast, compiler(registry));
}

/** The traits the query finds, in the order of the index. A query with no term finds them all. */
export function evaluate(
  ast: QueryNode | undefined,
  index: TraitIndex,
  registry: FieldRegistry = fieldRegistry,
): readonly Trait[] {
  return index.entries.filter(compileQuery(ast, registry)).map(({ trait }) => trait);
}
