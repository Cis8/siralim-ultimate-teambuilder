import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { QueryNode } from './ast';
import { tokenize } from './lexer';
import { MAX_NESTING, parseQuery } from './parser';

/** The structure of a node as a list: `weak OR snared stunned` is `(or weak (and snared stunned))`. */
function show(node: QueryNode | undefined): string {
  if (node === undefined) return '∅';
  switch (node.kind) {
    case 'term':
      return node.term.text;
    case 'not':
      return `(not ${show(node.operand)})`;
    case 'and':
    case 'or':
      return `(${node.kind} ${node.operands.map(show).join(' ')})`;
  }
}

const shapeOf = (source: string) => show(parseQuery(source).ast);

/** What the parser complained about: the code and the text at fault, in the order of the query. */
const problemsIn = (source: string) =>
  parseQuery(source).diagnostics.map(({ code, span }) => [code, source.slice(...span)]);

describe('parseQuery', () => {
  describe('the result', () => {
    it('gives the tokens it read from', () => {
      const source = 'weak OR (snared';
      expect(parseQuery(source).tokens).toEqual(tokenize(source));
    });

    it.each(['', '   ', '\n\t'])('reads no text, or only blanks, as no query at all: %j', (source) => {
      expect(parseQuery(source)).toEqual({ ast: undefined, tokens: [], diagnostics: [] });
    });

    it('reads one word as a term that carries its token', () => {
      const { ast, tokens, diagnostics } = parseQuery('class:life');
      expect(ast).toEqual({ kind: 'term', span: [0, 10], term: tokens[0] });
      expect(diagnostics).toEqual([]);
    });
  });

  describe('precedence: NOT binds tighter than AND, which binds tighter than OR', () => {
    it.each([
      ['weak snared stunned', '(and weak snared stunned)'],
      ['weak AND snared', '(and weak snared)'],
      ['weak & snared', '(and weak snared)'],
      ['weak and snared stunned', '(and weak snared stunned)'],
      ['weak OR snared', '(or weak snared)'],
      ['weak | snared', '(or weak snared)'],
      ['weak OR snared OR stunned', '(or weak snared stunned)'],
      ['a OR b c', '(or a (and b c))'],
      ['a b OR c', '(or (and a b) c)'],
      ['a b OR c d', '(or (and a b) (and c d))'],
      ['a OR b AND c OR d', '(or a (and b c) d)'],
      ['NOT a b', '(and (not a) b)'],
      ['a OR NOT b', '(or a (not b))'],
      ['-a OR b', '(or (not a) b)'],
      ['NOT NOT a', '(not (not a))'],
      ['--a', '(not (not a))'],
      ['a NOT b', '(and a (not b))'],
    ])('%s is %s', (source, expected) => {
      expect(shapeOf(source)).toBe(expected);
      expect(parseQuery(source).diagnostics).toEqual([]);
    });

    it('negates a fielded term and a phrase with a dash', () => {
      expect(shapeOf('-stack:no')).toBe('(not stack:no)');
      expect(shapeOf('-"start of battle" weak')).toBe('(and (not "start of battle") weak)');
    });
  });

  describe('parentheses', () => {
    it.each([
      ['(a OR b) c', '(and (or a b) c)'],
      ['a (b OR c)', '(and a (or b c))'],
      ['a AND (b OR c)', '(and a (or b c))'],
      ['-(weak OR snared)', '(not (or weak snared))'],
      ['NOT (a b)', '(not (and a b))'],
      ['(a OR b) AND (c OR d)', '(and (or a b) (or c d))'],
      ['((a))', 'a'],
      ['(a)(b)', '(and a b)'],
    ])('%s is %s', (source, expected) => {
      expect(shapeOf(source)).toBe(expected);
      expect(parseQuery(source).diagnostics).toEqual([]);
    });

    it('keeps a group written inside a group of the same kind as a node of its own', () => {
      expect(shapeOf('a OR (b OR c)')).toBe('(or a (or b c))');
      expect(shapeOf('(a b) c')).toBe('(and (and a b) c)');
    });
  });

  describe('spans', () => {
    it('cover the text a node was read from', () => {
      //       0         1
      //       01234567890123456
      const source = '-(weak OR snared)';
      const { ast } = parseQuery(source);
      expect(ast).toMatchObject({
        kind: 'not',
        span: [0, 17],
        operand: {
          kind: 'or',
          span: [1, 17],
          operands: [
            { kind: 'term', span: [2, 6] },
            { kind: 'term', span: [10, 16] },
          ],
        },
      });
    });

    it('run from the first operand to the last, whatever lies between them', () => {
      expect(parseQuery('a   AND  b   c').ast).toMatchObject({ kind: 'and', span: [0, 14] });
      expect(parseQuery('  a OR b  ').ast).toMatchObject({ kind: 'or', span: [2, 8] });
    });

    it('include the parentheses around a node, however many', () => {
      expect(parseQuery('(weak)').ast).toMatchObject({ kind: 'term', span: [0, 6], term: { span: [1, 5] } });
      expect(parseQuery('((a b))').ast).toMatchObject({ kind: 'and', span: [0, 7] });
      expect(parseQuery('x (a OR b)').ast).toMatchObject({
        operands: [{ span: [0, 1] }, { kind: 'or', span: [2, 10] }],
      });
    });

    it('start a negation at its dash or its NOT', () => {
      expect(parseQuery('x NOT  y').ast).toMatchObject({ operands: [{}, { kind: 'not', span: [2, 8] }] });
    });
  });

  describe('repairs, each reported with the text at fault', () => {
    describe('a ")" that closes nothing is read as if it were not there', () => {
      it.each([
        ['weak) snared', '(and weak snared)', [4]],
        [')weak', 'weak', [0]],
        ['(a))', 'a', [3]],
        ['a ) OR b', '(or a b)', [2]],
        [')', '∅', [0]],
        ['a ) ) b', '(and a b)', [2, 4]],
      ])('%s', (source, shape, at) => {
        expect(shapeOf(source)).toBe(shape);
        expect(parseQuery(source).diagnostics.map(({ code, span }) => [code, span[0]])).toEqual(
          at.map((index) => ['unmatched-close', index]),
        );
        expect(problemsIn(source).every(([, text]) => text === ')')).toBe(true);
      });
    });

    describe('a "(" left open is read as if ")" closed it at the end', () => {
      it('keeps what is inside', () => {
        expect(shapeOf('(weak OR snared')).toBe('(or weak snared)');
        expect(problemsIn('(weak OR snared')).toEqual([['unclosed-open', '(']]);
        expect(parseQuery('(weak OR snared').ast).toMatchObject({ span: [0, 15] });
      });

      it('reports each one, where it was opened', () => {
        expect(shapeOf('((a')).toBe('a');
        expect(parseQuery('((a').diagnostics.map(({ code, span }) => [code, span[0]])).toEqual([
          ['unclosed-open', 0],
          ['unclosed-open', 1],
        ]);
        expect(shapeOf('(a (b')).toBe('(and a b)');
        expect(parseQuery('(a (b').diagnostics.map(({ span }) => span[0])).toEqual([0, 3]);
      });

      it('reads a lone "(" as no query', () => {
        expect(shapeOf('(')).toBe('∅');
        expect(problemsIn('(')).toEqual([['unclosed-open', '(']]);
      });
    });

    describe('an operator without a term on one side is read as if it were not there', () => {
      it.each([
        ['weak OR', 'weak', ['OR']],
        ['OR weak', 'weak', ['OR']],
        ['weak AND', 'weak', ['AND']],
        ['AND weak', 'weak', ['AND']],
        ['weak |', 'weak', ['|']],
        ['& weak', 'weak', ['&']],
        ['OR', '∅', ['OR']],
        ['weak OR OR snared', '(or weak snared)', ['OR']],
        ['weak AND AND snared', '(and weak snared)', ['AND']],
        ['weak AND OR snared', '(or weak snared)', ['AND']],
        ['weak OR AND snared', '(or weak snared)', ['AND']],
        ['OR OR', '∅', ['OR', 'OR']],
        ['(OR weak)', 'weak', ['OR']],
        ['(weak OR) snared', '(and weak snared)', ['OR']],
        ['a OR (b AND) OR c', '(or a b c)', ['AND']],
      ])('%s', (source, shape, operators) => {
        expect(shapeOf(source)).toBe(shape);
        expect(problemsIn(source)).toEqual(operators.map((text) => ['dangling-operator', text]));
      });
    });

    describe('a NOT with nothing to negate is read as if it were not there', () => {
      it.each([
        ['weak NOT', 'weak', [['missing-operand', 'NOT']]],
        ['NOT', '∅', [['missing-operand', 'NOT']]],
        ['weak -', 'weak', [['missing-operand', '-']]],
        [
          'NOT NOT',
          '∅',
          [
            ['missing-operand', 'NOT'],
            ['missing-operand', 'NOT'],
          ],
        ],
        [
          '(NOT) weak',
          'weak',
          [
            ['empty-group', '(NOT)'],
            ['missing-operand', 'NOT'],
          ],
        ],
        [
          'NOT OR weak',
          'weak',
          [
            ['missing-operand', 'NOT'],
            ['dangling-operator', 'OR'],
          ],
        ],
        [
          'a AND NOT',
          'a',
          [
            ['dangling-operator', 'AND'],
            ['missing-operand', 'NOT'],
          ],
        ],
      ])('%s', (source, shape, found) => {
        expect(shapeOf(source)).toBe(shape);
        expect(problemsIn(source)).toEqual(found);
      });
    });

    describe('an empty pair of parentheses is read as if it were not there', () => {
      it.each([
        ['()', '∅', ['()']],
        ['() weak', 'weak', ['()']],
        ['weak ( )', 'weak', ['( )']],
        ['(())', '∅', ['(())', '()']],
        ['a OR (b ()) ', '(or a b)', ['()']],
      ])('%s', (source, shape, found) => {
        expect(shapeOf(source)).toBe(shape);
        expect(problemsIn(source)).toEqual(found.map((text) => ['empty-group', text]));
      });

      it('is reported next to the operator it leaves without a term', () => {
        expect(problemsIn('weak OR ()')).toEqual([
          ['dangling-operator', 'OR'],
          ['empty-group', '()'],
        ]);
      });

      it('is not reported as empty when it is the missing ")" that is at fault', () => {
        expect(problemsIn('( OR')).toEqual([
          ['unclosed-open', '('],
          ['dangling-operator', 'OR'],
        ]);
      });
    });

    describe('a quote left open', () => {
      it('is reported at the phrase, and the phrase is kept', () => {
        expect(shapeOf('weak "start of')).toBe('(and weak "start of)');
        expect(problemsIn('weak "start of')).toEqual([['unclosed-quote', '"start of']]);
      });

      it('is reported at the phrase of a fielded term, not at its field', () => {
        expect(problemsIn('class:"rodian master')).toEqual([['unclosed-quote', '"rodian master']]);
      });

      it('swallows the parentheses after it, so none is left unclosed', () => {
        expect(shapeOf('(weak "or (snared')).toBe('(and weak "or (snared)');
        expect(problemsIn('(weak "or (snared')).toEqual([
          ['unclosed-open', '('],
          ['unclosed-quote', '"or (snared'],
        ]);
      });
    });

    it('lists the problems in the order of the query, not in the order they were found', () => {
      expect(problemsIn('(weak OR')).toEqual([
        ['unclosed-open', '('],
        ['dangling-operator', 'OR'],
      ]);
      expect(problemsIn('a ) NOT (b "c')).toEqual([
        ['unmatched-close', ')'],
        ['unclosed-open', '('],
        ['unclosed-quote', '"c'],
      ]);
    });

    it('says what is wrong in the words of QUERY_LANGUAGE §5', () => {
      const messages = (source: string) => parseQuery(source).diagnostics.map(({ message }) => message);
      expect(messages(')')).toEqual(['Unmatched “)”']);
      expect(messages('(a')).toEqual(['Unclosed “(”']);
      expect(messages('a or')).toEqual(['“or” needs a term on both sides']);
      expect(messages('-')).toEqual(['“-” needs a term after it']);
      expect(messages('()')).toEqual(['Nothing between “(” and “)”']);
      expect(messages('"a')).toEqual(['Unclosed quote']);
    });

    it('calls every one an error', () => {
      const { diagnostics } = parseQuery(') OR - ( () "');
      expect(diagnostics.length).toBeGreaterThan(4);
      expect(new Set(diagnostics.map(({ severity }) => severity))).toEqual(new Set(['error']));
    });
  });

  describe('nesting', () => {
    const nested = (depth: number) => `${'('.repeat(depth)}a${')'.repeat(depth)}`;

    it('reads parentheses up to the limit without complaint', () => {
      expect(parseQuery(nested(MAX_NESTING))).toMatchObject({ ast: { kind: 'term' }, diagnostics: [] });
    });

    it('counts NOT as nesting too', () => {
      expect(parseQuery(`${'NOT '.repeat(MAX_NESTING)}a`).diagnostics).toEqual([]);
      expect(problemsIn(`${'NOT '.repeat(MAX_NESTING + 1)}a`)).toEqual([['nested-too-deeply', 'NOT']]);
    });

    it('ignores a "(" past the limit, and says so', () => {
      const source = nested(MAX_NESTING + 1);
      expect(shapeOf(source)).toBe('a');
      expect(problemsIn(source)).toEqual([
        ['nested-too-deeply', '('],
        ['unmatched-close', ')'],
      ]);
    });

    it('reads a NOT past the limit as if it were not there, and keeps the rest of the query', () => {
      const negations = Array.from({ length: MAX_NESTING + 5 }, () => 'NOT').join(' ');
      let expected = 'a';
      for (let i = 0; i < MAX_NESTING; i++) expected = `(not ${expected})`;
      expect(shapeOf(`${negations} a b`)).toBe(`(and ${expected} b)`);
      expect(parseQuery(`${negations} a b`).diagnostics).toHaveLength(5);
    });

    it.each([
      ['(', 'a', ')'],
      ['NOT ', 'a', ''],
      ['-', 'a', ''],
      ['(NOT ', 'a', ')'],
    ])('survives a hundred thousand of %s', (opening, term, closing) => {
      const source = `${opening.repeat(100_000)}${term}${closing.repeat(100_000)}`;
      const { ast } = parseQuery(source);
      expect(ast).toBeDefined();
      let depth = 0;
      for (let node: QueryNode | undefined = ast; node?.kind === 'not'; node = node.operand) depth++;
      expect(depth).toBeLessThanOrEqual(MAX_NESTING);
    });
  });

  describe('for any text', () => {
    const piece = fc.constantFrom(
      '(',
      ')',
      '"',
      '-',
      ' ',
      ' ',
      'weak',
      'class:life',
      'class:',
      'OR',
      'AND',
      'NOT',
      '|',
      '&',
      'é',
    );
    const queryLike = fc.array(piece, { maxLength: 30 }).map((pieces) => pieces.join(' '));
    const anyText = fc.oneof(queryLike, queryLike, fc.string({ unit: 'binary' }));

    const within = (inner: readonly [number, number], outer: readonly [number, number]) =>
      inner[0] >= outer[0] && inner[1] <= outer[1];

    /** Every node below `node` is inside it, and every operand starts after the one before it. */
    function expectNested(node: QueryNode): void {
      const children = node.kind === 'not' ? [node.operand] : node.kind === 'term' ? [] : [...node.operands];
      if (node.kind === 'and' || node.kind === 'or') expect(node.operands.length).toBeGreaterThanOrEqual(2);
      let end = node.span[0];
      for (const child of children) {
        expect(within(child.span, node.span)).toBe(true);
        expect(child.span[0]).toBeGreaterThanOrEqual(end);
        end = child.span[1];
        expectNested(child);
      }
    }

    const termsOf = (node: QueryNode | undefined): string[] =>
      node === undefined
        ? []
        : node.kind === 'term'
          ? [node.term.text]
          : node.kind === 'not'
            ? termsOf(node.operand)
            : node.operands.flatMap(termsOf);

    it('never throws, and returns spans that lie inside the text and inside each other', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const { ast, diagnostics } = parseQuery(source);
          const whole: readonly [number, number] = [0, source.length];
          if (ast !== undefined) {
            expect(within(ast.span, whole)).toBe(true);
            expectNested(ast);
          }
          for (const { span } of diagnostics) {
            expect(span[0]).toBeLessThan(span[1]);
            expect(within(span, whole)).toBe(true);
          }
          expect(diagnostics.map(({ span }) => span[0])).toEqual(
            diagnostics.map(({ span }) => span[0]).sort((a, b) => a - b),
          );
        }),
      );
    });

    it('keeps every term it was given, in order: a repair never drops one', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const { ast, tokens } = parseQuery(source);
          const written = tokens.flatMap((token) => (token.kind === 'term' ? [token.text] : []));
          expect(termsOf(ast)).toEqual(written);
        }),
      );
    });

    type Tree = { term: string } | { not: Tree } | { and: Tree[] } | { or: Tree[] };

    const tree = fc.letrec<{ tree: Tree }>((tie) => ({
      tree: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        fc
          .constantFrom('weak', 'snared', 'class:life', 'kw:"start of battle"', '"two words"')
          .map((term) => ({ term })),
        tie('tree').map((operand) => ({ not: operand })),
        fc.array(tie('tree'), { minLength: 2, maxLength: 4 }).map((operands) => ({ and: operands })),
        fc.array(tie('tree'), { minLength: 2, maxLength: 4 }).map((operands) => ({ or: operands })),
      ),
    })).tree;

    const showTree = (t: Tree): string =>
      'term' in t
        ? t.term
        : 'not' in t
          ? `(not ${showTree(t.not)})`
          : 'and' in t
            ? `(and ${t.and.map(showTree).join(' ')})`
            : `(or ${t.or.map(showTree).join(' ')})`;

    /** Binding strength: a child that binds no tighter than its parent needs parentheses to stay a node of its own. */
    const strength = (t: Tree) => ('or' in t ? 1 : 'and' in t ? 2 : 'not' in t ? 3 : 4);

    const AND_SPELLINGS = [' ', ' AND ', ' and ', ' & '];
    const OR_SPELLINGS = [' OR ', ' or ', ' | '];
    const NOT_SPELLINGS = ['NOT ', 'not ', '-'];

    function write(t: Tree, choice: number): string {
      const child = (c: Tree, parent: number, tight: boolean) => {
        const text = write(c, choice + 1);
        return tight ? (strength(c) < parent ? `(${text})` : text) : strength(c) <= parent ? `(${text})` : text;
      };
      if ('term' in t) return t.term;
      if ('not' in t) return `${NOT_SPELLINGS[choice % 3]}${child(t.not, 3, true)}`;
      if ('and' in t) return t.and.map((c) => child(c, 2, false)).join(AND_SPELLINGS[choice % 4]);
      return t.or.map((c) => child(c, 1, false)).join(OR_SPELLINGS[choice % 3]);
    }

    it('reads back the structure of a query written with the precedence rules, in any spelling', () => {
      fc.assert(
        fc.property(tree, fc.nat(), (t, choice) => {
          const source = write(t, choice);
          const { ast, diagnostics } = parseQuery(source);
          expect(diagnostics).toEqual([]);
          expect(show(ast)).toBe(showTree(t));
        }),
      );
    });
  });
});
