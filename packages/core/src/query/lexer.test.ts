import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { tokenize } from './lexer';

/** What the tokens are and what they say, ignoring where they are. */
const shapes = (source: string) => tokenize(source).map((token) => [token.kind, token.text]);

describe('tokenize', () => {
  describe('terms', () => {
    it('splits on blanks and gives each word the exact span it covers', () => {
      expect(tokenize('vulnerable  weak')).toEqual([
        { kind: 'term', text: 'vulnerable', span: [0, 10], value: 'vulnerable', valueSpan: [0, 10], quote: 'none' },
        { kind: 'term', text: 'weak', span: [12, 16], value: 'weak', valueSpan: [12, 16], quote: 'none' },
      ]);
    });

    it.each(['', '   ', '\n\t '])('finds nothing in no text or only blanks: %j', (source) => {
      expect(tokenize(source)).toEqual([]);
    });

    it('treats any blank as a separator', () => {
      expect(shapes('weak\n\tsnared stunned')).toEqual([
        ['term', 'weak'],
        ['term', 'snared'],
        ['term', 'stunned'],
      ]);
    });

    it('keeps a dash inside a word', () => {
      expect(shapes('well-known 5-3')).toEqual([
        ['term', 'well-known'],
        ['term', '5-3'],
      ]);
    });
  });

  describe('fields', () => {
    it('reads the field, as written, and the value after the colon', () => {
      expect(tokenize('Class:Life')).toEqual([
        {
          kind: 'term',
          text: 'Class:Life',
          span: [0, 10],
          field: { name: 'Class', span: [0, 5] },
          value: 'Life',
          valueSpan: [6, 10],
          quote: 'none',
        },
      ]);
    });

    it('takes a phrase as the value: class:"rodian master"', () => {
      expect(tokenize('class:"rodian master"')).toEqual([
        {
          kind: 'term',
          text: 'class:"rodian master"',
          span: [0, 21],
          field: { name: 'class', span: [0, 5] },
          value: 'rodian master',
          valueSpan: [6, 21],
          quote: 'closed',
        },
      ]);
    });

    it('splits at the first colon: the rest is the value', () => {
      const [token] = tokenize('desc:at:start');
      expect(token).toMatchObject({ field: { name: 'desc' }, value: 'at:start' });
    });

    it('keeps a slash in the value: the actor of an event (uses:provoke/self) is not the lexer’s to read', () => {
      const [token] = tokenize('uses:provoke/self');
      expect(token).toMatchObject({ field: { name: 'uses' }, value: 'provoke/self', quote: 'none' });
      expect(tokenize('u:"start of turn/enemy" kw:/self')).toMatchObject([
        { value: 'start of turn/enemy', quote: 'closed' },
        { value: '/self' },
      ]);
    });

    it('reads a field with no value yet, whose empty value span sits right after the colon', () => {
      expect(tokenize('(applies:)')).toEqual([
        { kind: 'open', text: '(', span: [0, 1] },
        {
          kind: 'term',
          text: 'applies:',
          span: [1, 9],
          field: { name: 'applies', span: [1, 8] },
          value: '',
          valueSpan: [9, 9],
          quote: 'none',
        },
        { kind: 'close', text: ')', span: [9, 10] },
      ]);
    });

    it('does not let a blank after the colon pass the next word on as the value', () => {
      expect(shapes('applies: weak')).toEqual([
        ['term', 'applies:'],
        ['term', 'weak'],
      ]);
    });

    it.each(['12:30', ':life', 'a-b:c', 'é:x'])('is not a field unless letters come before the colon: %s', (source) => {
      const [token] = tokenize(source);
      expect(token).toMatchObject({ kind: 'term', text: source, value: source });
      expect(token).not.toHaveProperty('field');
    });
  });

  describe('phrases', () => {
    it('reads a phrase without a field', () => {
      expect(tokenize('"start of battle" weak')).toEqual([
        {
          kind: 'term',
          text: '"start of battle"',
          span: [0, 17],
          value: 'start of battle',
          valueSpan: [0, 17],
          quote: 'closed',
        },
        { kind: 'term', text: 'weak', span: [18, 22], value: 'weak', valueSpan: [18, 22], quote: 'none' },
      ]);
    });

    it('trims the blanks just inside the quotes, and keeps the quotes in the span', () => {
      const [token] = tokenize('"  spaced out  "');
      expect(token).toMatchObject({ value: 'spaced out', span: [0, 16], valueSpan: [0, 16] });
    });

    it('keeps parentheses and operators inside a phrase', () => {
      expect(shapes('"(weak OR snared)"')).toEqual([['term', '"(weak OR snared)"']]);
    });

    it('reads an empty phrase as a term with an empty value', () => {
      expect(tokenize('""')).toEqual([
        { kind: 'term', text: '""', span: [0, 2], value: '', valueSpan: [0, 2], quote: 'closed' },
      ]);
    });

    it('ends a word at a quote: the phrase after it is a term of its own', () => {
      expect(shapes('weak"snared" class:life"x"')).toEqual([
        ['term', 'weak'],
        ['term', '"snared"'],
        ['term', 'class:life'],
        ['term', '"x"'],
      ]);
    });

    describe('unclosed', () => {
      it('runs to the end of the text', () => {
        expect(tokenize('weak "start of')).toEqual([
          { kind: 'term', text: 'weak', span: [0, 4], value: 'weak', valueSpan: [0, 4], quote: 'none' },
          { kind: 'term', text: '"start of', span: [5, 14], value: 'start of', valueSpan: [5, 14], quote: 'unclosed' },
        ]);
      });

      it('swallows parentheses and operators after it', () => {
        expect(shapes('(weak "or (snared)')).toEqual([
          ['open', '('],
          ['term', 'weak'],
          ['term', '"or (snared)'],
        ]);
      });

      it('keeps the field of a fielded phrase', () => {
        const [token] = tokenize('class:"rodian master');
        expect(token).toMatchObject({
          field: { name: 'class', span: [0, 5] },
          value: 'rodian master',
          valueSpan: [6, 20],
          quote: 'unclosed',
        });
      });

      it('reads a lone quote as an empty phrase', () => {
        expect(tokenize('"')).toEqual([
          { kind: 'term', text: '"', span: [0, 1], value: '', valueSpan: [0, 1], quote: 'unclosed' },
        ]);
      });
    });
  });

  describe('parentheses', () => {
    it('are tokens of their own with their own span', () => {
      expect(tokenize('(weak)')).toEqual([
        { kind: 'open', text: '(', span: [0, 1] },
        { kind: 'term', text: 'weak', span: [1, 5], value: 'weak', valueSpan: [1, 5], quote: 'none' },
        { kind: 'close', text: ')', span: [5, 6] },
      ]);
    });

    it('end a word without a blank: a(b)c', () => {
      expect(shapes('a(b)c')).toEqual([
        ['term', 'a'],
        ['open', '('],
        ['term', 'b'],
        ['close', ')'],
        ['term', 'c'],
      ]);
    });

    it('are read even when they do not match', () => {
      expect(shapes(')weak((')).toEqual([
        ['close', ')'],
        ['term', 'weak'],
        ['open', '('],
        ['open', '('],
      ]);
    });
  });

  describe('operators', () => {
    it.each(['AND', 'and', 'And', '&'])('reads %s as AND', (written) => {
      expect(shapes(`weak ${written} snared`)[1]).toEqual(['and', written]);
    });

    it.each(['OR', 'or', 'Or', '|'])('reads %s as OR', (written) => {
      expect(shapes(`weak ${written} snared`)[1]).toEqual(['or', written]);
    });

    it.each(['NOT', 'not', 'Not'])('reads %s as NOT', (written) => {
      expect(shapes(`${written} weak`)[0]).toEqual(['not', written]);
    });

    it('gives an operator its span', () => {
      expect(tokenize('a OR b')[1]).toEqual({ kind: 'or', text: 'OR', span: [2, 4] });
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'is not mistaken for a property of the operator table: %s',
      (word) => {
        expect(shapes(word)).toEqual([['term', word]]);
      },
    );

    it.each(['android', 'order', 'nothing', 'a|b', 'a&b', '&&', '||'])(
      'is an operator only as a whole word of its own: %s',
      (source) => {
        expect(shapes(source)).toEqual([['term', source]]);
      },
    );

    it.each(['"or"', '"AND"', 'kw:or', 'and:x'])(
      'is not an operator when quoted or used as a value or field: %s',
      (source) => {
        expect(shapes(source)).toEqual([['term', source]]);
      },
    );

    it('delimits an operator with parentheses', () => {
      expect(shapes('(weak)OR(snared)').map(([kind]) => kind)).toEqual([
        'open',
        'term',
        'close',
        'or',
        'open',
        'term',
        'close',
      ]);
    });
  });

  describe('negation with a dash', () => {
    it('reads -stack:no as a NOT and a fielded term, each with its span', () => {
      expect(tokenize('-stack:no')).toEqual([
        { kind: 'not', text: '-', span: [0, 1] },
        {
          kind: 'term',
          text: 'stack:no',
          span: [1, 9],
          field: { name: 'stack', span: [1, 6] },
          value: 'no',
          valueSpan: [7, 9],
          quote: 'none',
        },
      ]);
    });

    it('reads -(weak OR snared) as a NOT before a group', () => {
      expect(shapes('-(weak OR snared)')).toEqual([
        ['not', '-'],
        ['open', '('],
        ['term', 'weak'],
        ['or', 'OR'],
        ['term', 'snared'],
        ['close', ')'],
      ]);
    });

    it('negates a phrase', () => {
      expect(shapes('-"start of battle"')).toEqual([
        ['not', '-'],
        ['term', '"start of battle"'],
      ]);
    });

    it('stacks: --weak is a NOT of a NOT', () => {
      expect(shapes('--weak')).toEqual([
        ['not', '-'],
        ['not', '-'],
        ['term', 'weak'],
      ]);
    });

    it('is a NOT on its own too, so that the parser can say what it lacks', () => {
      expect(shapes('weak -')).toEqual([
        ['term', 'weak'],
        ['not', '-'],
      ]);
    });

    it('is a dash only at the start of a token: a value keeps its own', () => {
      expect(shapes('weak -snared class:-life')).toEqual([
        ['term', 'weak'],
        ['not', '-'],
        ['term', 'snared'],
        ['term', 'class:-life'],
      ]);
    });
  });

  describe('for any text', () => {
    const piece = fc.constantFrom(
      '(',
      ')',
      '"',
      '-',
      ':',
      ' ',
      '\n',
      'a',
      'class',
      'class:',
      'OR',
      'and',
      '|',
      '&',
      'NOT',
      'é',
      '😀',
    );
    const queryLike = fc.array(piece, { maxLength: 24 }).map((pieces) => pieces.join(''));
    const anyText = fc.oneof(queryLike, fc.string({ unit: 'binary' }));

    it('never throws, and the tokens are the text, in order, without overlap, and nothing but blanks between them', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          let end = 0;
          for (const token of tokenize(source)) {
            const [start, stop] = token.span;
            expect(start).toBeGreaterThanOrEqual(end);
            expect(stop).toBeGreaterThan(start);
            expect(source.slice(start, stop)).toBe(token.text);
            expect(source.slice(end, start).trim()).toBe('');
            end = stop;
          }
          expect(source.slice(end).trim()).toBe('');
        }),
      );
    });

    it('reads a term with its field and value inside its span', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          for (const token of tokenize(source)) {
            if (token.kind !== 'term') continue;
            const [start, stop] = token.span;
            const [valueStart, valueStop] = token.valueSpan;
            expect(valueStart).toBeGreaterThanOrEqual(start);
            expect(valueStop).toBeLessThanOrEqual(stop);
            expect(source.slice(valueStart, valueStop)).toContain(token.value);
            if (token.field !== undefined) {
              expect(token.field.span).toEqual([start, start + token.field.name.length]);
              expect(source[token.field.span[1]]).toBe(':');
              expect(valueStart).toBe(token.field.span[1] + 1);
            }
          }
        }),
      );
    });

    it('reads the same tokens when they are written back with single blanks', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const tokens = tokenize(source);
          const rewritten = tokenize(tokens.map((token) => token.text).join(' '));
          expect(rewritten.map((token) => [token.kind, token.text])).toEqual(
            tokens.map((token) => [token.kind, token.text]),
          );
        }),
      );
    });
  });
});
