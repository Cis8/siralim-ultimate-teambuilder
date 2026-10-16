import { describe, expect, it } from 'vitest';
import type { QueryNode } from './ast';
import { parseQuery } from './parser';
import { visitQuery, type QueryVisitor } from './visitor';

/** Reads a query back as a tree in parentheses, so that a test sees what each visitor method was given. */
const asTree: QueryVisitor<string> = {
  term: ({ term }) => term.value,
  not: (_node, operand) => `(not ${operand})`,
  and: (_node, operands) => `(and ${operands.join(' ')})`,
  or: (_node, operands) => `(or ${operands.join(' ')})`,
};

function ast(source: string): QueryNode {
  const { ast: parsed } = parseQuery(source);
  if (parsed === undefined) throw new Error(`"${source}" has no term`);
  return parsed;
}

describe('visitQuery', () => {
  it('gives a term to the term method', () => {
    expect(visitQuery(ast('weak'), asTree)).toBe('weak');
  });

  it('gives a negation the result of its operand', () => {
    expect(visitQuery(ast('-weak'), asTree)).toBe('(not weak)');
  });

  it('gives a conjunction the results of its operands, in the order of the query', () => {
    expect(visitQuery(ast('weak snared stunned'), asTree)).toBe('(and weak snared stunned)');
  });

  it('gives a disjunction the results of its operands, in the order of the query', () => {
    expect(visitQuery(ast('weak OR snared OR stunned'), asTree)).toBe('(or weak snared stunned)');
  });

  it('follows precedence and nesting down to the terms', () => {
    expect(visitQuery(ast('(vulnerable OR weak) -stack:no'), asTree)).toBe('(and (or vulnerable weak) (not no))');
    expect(visitQuery(ast('-(a OR -(b c))'), asTree)).toBe('(not (or a (not (and b c))))');
  });

  it('hands each method the node it is for, so that it can read the span', () => {
    const seen: string[] = [];
    const record = (kind: string, span: readonly [number, number]): number => seen.push(`${kind} ${span.join('-')}`);
    visitQuery(ast('weak OR (snared stunned)'), {
      term: ({ span }) => record('term', span),
      not: () => 0,
      and: ({ span }) => record('and', span),
      or: ({ span }) => record('or', span),
    });
    expect(seen).toEqual(['term 0-4', 'term 9-15', 'term 16-23', 'and 8-24', 'or 0-24']);
  });
});
