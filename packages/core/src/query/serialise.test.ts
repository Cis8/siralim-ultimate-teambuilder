import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { QueryNode, TermNode } from './ast';
import { parseQuery } from './parser';
import { serialise } from './serialise';

const astOf = (source: string): QueryNode | undefined => parseQuery(source).ast;
const canonical = (source: string): string => serialise(astOf(source));

/** What a query means, spans and spelling aside: `weak OR "two words" -class:life` is `(or weak "two words" (not class:life))`. */
function meaning(node: QueryNode | undefined): string {
  if (node === undefined) return '∅';
  switch (node.kind) {
    case 'term':
      return `${node.term.field?.name ?? ''}:${JSON.stringify(node.term.value)}`;
    case 'not':
      return `(not ${meaning(node.operand)})`;
    case 'and':
    case 'or':
      return `(${node.kind} ${node.operands.map(meaning).join(' ')})`;
  }
}

describe('serialise', () => {
  it('writes no query at all as no text', () => {
    expect(serialise(undefined)).toBe('');
    expect(canonical('   ')).toBe('');
  });

  describe('a term', () => {
    it.each([
      ['weak', 'weak'],
      ['  weak  ', 'weak'],
      ['class:life', 'class:life'],
      ['Applies:Weak', 'Applies:Weak'],
      ['kw:"start of battle"', 'kw:"start of battle"'],
      ['"rodian master"', '"rodian master"'],
    ])('keeps %j as %j', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });

    it.each([
      ['"weak"', 'weak'],
      ['class:"life"', 'class:life'],
      ['"well-known"', 'well-known'],
      ['"a|b"', 'a|b'],
      ['class:"or"', 'class:or'],
      ['class:"-x"', 'class:-x'],
      ['class:"a:b"', 'class:a:b'],
    ])('drops the quotes of %j where the lexer reads the same without them: %j', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });

    it.each([
      ['"and"', '"and"'],
      ['"OR"', '"OR"'],
      ['"not"', '"not"'],
      ['"&"', '"&"'],
      ['"|"', '"|"'],
      ['"-weak"', '"-weak"'],
      ['"-"', '"-"'],
      ['"class:life"', '"class:life"'],
      ['"("', '"("'],
      ['"a (b)"', '"a (b)"'],
      ['class:"a (b)"', 'class:"a (b)"'],
    ])('keeps the quotes of %j, which the lexer would read as something else without them', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });

    it('writes a value that is not there yet the way that reads back as that', () => {
      expect(canonical('applies:')).toBe('applies:');
      expect(canonical('class:""')).toBe('class:');
      expect(canonical('""')).toBe('""');
      expect(canonical('weak applies: (a OR class:) b')).toBe('weak applies: (a OR class:) b');
    });

    it('trims a phrase, as the lexer does', () => {
      expect(canonical('"  rodian master "')).toBe('"rodian master"');
      expect(canonical('"  weak "')).toBe('weak');
    });
  });

  describe('the operators', () => {
    it.each([
      ['a   b', 'a b'],
      ['a AND b', 'a b'],
      ['a and b', 'a b'],
      ['a & b', 'a b'],
      ['a OR b', 'a OR b'],
      ['a or b', 'a OR b'],
      ['a | b', 'a OR b'],
      ['a OR b OR c', 'a OR b OR c'],
      ['NOT a', '-a'],
      ['not a', '-a'],
      ['-a', '-a'],
      ['-stack:no', '-stack:no'],
      ['--a', '--a'],
      ['NOT NOT a', '--a'],
      ['- -a', '--a'],
      ['-"two words"', '-"two words"'],
    ])('writes %j as %j', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });
  });

  describe('the parentheses: only where the tree needs them', () => {
    it.each([
      // precedence does the work
      ['a OR b c', 'a OR b c'],
      ['a OR (b c)', 'a OR b c'],
      ['a b OR c d', 'a b OR c d'],
      ['(a b) OR (c d)', 'a b OR c d'],
      ['-a b', '-a b'],
      ['(-a) b', '-a b'],
      ['a OR -b', 'a OR -b'],
      ['(a)', 'a'],
      ['((a OR b))', 'a OR b'],
      ['(-(a))', '-a'],
      // a lower operator inside a higher one
      ['(a OR b) c', '(a OR b) c'],
      ['a (b OR c)', 'a (b OR c)'],
      ['(a OR b) (c OR d)', '(a OR b) (c OR d)'],
      // a group of the same kind is a node of its own
      ['a (b c)', 'a (b c)'],
      ['(a b) (c d)', '(a b) (c d)'],
      ['a OR (b OR c)', 'a OR (b OR c)'],
      ['(a OR b) OR c', '(a OR b) OR c'],
      ['a AND (b AND c)', 'a (b c)'],
      // what a negation covers
      ['-(a OR b)', '-(a OR b)'],
      ['-(a b)', '-(a b)'],
      ['NOT (a b)', '-(a b)'],
      ['-(-a)', '--a'],
      ['-(a OR -(b c))', '-(a OR -(b c))'],
      ['(a OR b) -(c d)', '(a OR b) -(c d)'],
    ])('writes %j as %j', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });
  });

  describe('a query that needed repairs', () => {
    it.each([
      ['a OR', 'a'],
      ['OR a', 'a'],
      ['a AND AND b', 'a b'],
      ['(a OR b', 'a OR b'],
      ['a b)', 'a b'],
      ['a ()', 'a'],
      ['a NOT', 'a'],
      ['class:"rodian master', 'class:"rodian master"'],
      ['"rodian', 'rodian'],
    ])('is written as the query it was read as: %j is %j', (source, expected) => {
      expect(canonical(source)).toBe(expected);
    });
  });

  describe('for any query', () => {
    const piece = fc.constantFrom(
      '(',
      ')',
      '"',
      '-',
      'weak',
      'Class:life',
      'class:',
      'class:"rodian master"',
      '"and"',
      '"-x"',
      '"a:b"',
      'OR',
      'AND',
      'NOT',
      '|',
      '&',
      'é',
    );
    const queryLike = fc.array(piece, { maxLength: 30 }).map((pieces) => pieces.join(' '));
    const anyText = fc.oneof(queryLike, queryLike, fc.string({ unit: 'binary' }));

    it('reads back as the same query, and writes itself the same way again', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const { ast } = parseQuery(source);
          const text = serialise(ast);
          const again = parseQuery(text);
          expect(again.diagnostics, text).toEqual([]);
          expect(meaning(again.ast), text).toBe(meaning(ast));
          expect(serialise(again.ast), text).toBe(text);
        }),
      );
    });
  });

  describe('for any tree', () => {
    /** Values that make the lexer read something else if they are not quoted. */
    const trickyValue = fc.constantFrom(
      'weak',
      'two words',
      'and',
      'Or',
      'NOT',
      '&',
      '|',
      '-',
      '-weak',
      'a|b',
      'well-known',
      'a:b',
      'a (b) c',
      '(',
      ')',
      '',
      'é',
    );
    const anyValue = fc.oneof(
      trickyValue,
      fc
        .string({ unit: fc.constantFrom('a', 'B', '-', ':', '|', '&', '(', ')', ' ', '\t'), maxLength: 6 })
        .map((value) => value.trim()),
    );
    const anyField = fc.constantFrom(undefined, 'class', 'Applies', 'AND', 'zz');

    const termNode = fc.record({ field: anyField, value: anyValue }).map(({ field, value }): TermNode => {
      const text = field === undefined ? value : `${field}:${value}`;
      const fieldName = field === undefined ? {} : { field: { name: field, span: [0, 0] as const } };
      return {
        kind: 'term',
        span: [0, 0],
        term: { kind: 'term', text, span: [0, 0], ...fieldName, value, valueSpan: [0, 0], quote: 'none' },
      };
    });

    const tree = fc.letrec<{ tree: QueryNode }>((tie) => ({
      tree: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        termNode,
        tie('tree').map((operand): QueryNode => ({ kind: 'not', span: [0, 0], operand })),
        fc
          .array(tie('tree'), { minLength: 2, maxLength: 4 })
          .map((operands): QueryNode => ({ kind: 'and', span: [0, 0], operands })),
        fc
          .array(tie('tree'), { minLength: 2, maxLength: 4 })
          .map((operands): QueryNode => ({ kind: 'or', span: [0, 0], operands })),
      ),
    })).tree;

    it('is read back as the tree it was written from', () => {
      fc.assert(
        fc.property(tree, (ast) => {
          const text = serialise(ast);
          const { ast: back, diagnostics } = parseQuery(text);
          expect(diagnostics, text).toEqual([]);
          expect(meaning(back), text).toBe(meaning(ast));
        }),
      );
    });
  });
});
