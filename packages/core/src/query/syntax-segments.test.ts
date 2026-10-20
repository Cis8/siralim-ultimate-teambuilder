import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { QueryDiagnostic } from './diagnostic';
import { tokenize } from './lexer';
import { parseQuery } from './parser';
import type { Span } from './span';
import { syntaxSegments, type SyntaxSegment } from './syntax-segments';

/** The segments of a text with no diagnostics. */
const segmentsOf = (source: string): SyntaxSegment[] => syntaxSegments(source, tokenize(source), []);

/** The segments of a text as `[kind, text]` pairs, which is how the golden tables read. */
const readAs = (source: string): [string, string][] => segmentsOf(source).map(({ kind, text }) => [kind, text]);

const diagnostic = (severity: QueryDiagnostic['severity'], span: Span): QueryDiagnostic => ({
  code: 'test',
  severity,
  span,
  message: 'test',
});

/** The segments of a text that carry a severity, as `[text, severity]`. */
function marked(source: string, diagnostics: readonly QueryDiagnostic[]): [string, string | undefined][] {
  return syntaxSegments(source, tokenize(source), diagnostics).map(({ text, severity }) => [text, severity]);
}

/** Texts made of the characters that mean something to the lexer, so that the properties meet every kind of token. */
const queryText = fc.stringMatching(/^[a-zA-Z:"()| &\-/]{0,40}$/);

describe('syntaxSegments', () => {
  describe('the kind of each piece of a query', () => {
    it('names every kind', () => {
      expect(readAs('(weak OR snared) -class:life "two words"')).toEqual([
        ['paren', '('],
        ['text', 'weak'],
        ['blank', ' '],
        ['operator', 'OR'],
        ['blank', ' '],
        ['text', 'snared'],
        ['paren', ')'],
        ['blank', ' '],
        ['negation', '-'],
        ['field', 'class:'],
        ['value', 'life'],
        ['blank', ' '],
        ['phrase', '"two words"'],
      ]);
    });

    it('splits a field from its value, the colon going with the field', () => {
      expect(readAs('applies:vulnerable')).toEqual([
        ['field', 'applies:'],
        ['value', 'vulnerable'],
      ]);
      expect(readAs('Class:Life')).toEqual([
        ['field', 'Class:'],
        ['value', 'Life'],
      ]);
    });

    it('draws a field with no value yet as the field alone', () => {
      expect(readAs('applies:')).toEqual([['field', 'applies:']]);
      expect(readAs('a: b')).toEqual([
        ['field', 'a:'],
        ['blank', ' '],
        ['text', 'b'],
      ]);
    });

    it('draws the value of a field in quotes as a phrase, closed or not', () => {
      expect(readAs('trait:"two words"')).toEqual([
        ['field', 'trait:'],
        ['phrase', '"two words"'],
      ]);
      expect(readAs('trait:"two wo')).toEqual([
        ['field', 'trait:'],
        ['phrase', '"two wo'],
      ]);
      expect(readAs('"')).toEqual([['phrase', '"']]);
    });

    it('draws a word with no field as text, and a field nobody knows as a field, as it is typed', () => {
      expect(readAs('weak')).toEqual([['text', 'weak']]);
      expect(readAs('clas:life')).toEqual([
        ['field', 'clas:'],
        ['value', 'life'],
      ]);
    });

    it.each(['AND', 'and', 'OR', 'Or', '&', '|', 'NOT', 'not'])('draws %j between terms as an operator', (operator) => {
      expect(readAs(`a ${operator} b`)).toEqual([
        ['text', 'a'],
        ['blank', ' '],
        ['operator', operator],
        ['blank', ' '],
        ['text', 'b'],
      ]);
    });

    it('draws the dash that negates as a negation of its own, in front of what it negates', () => {
      expect(readAs('--weak')).toEqual([
        ['negation', '-'],
        ['negation', '-'],
        ['text', 'weak'],
      ]);
      expect(readAs('-(a)')).toEqual([
        ['negation', '-'],
        ['paren', '('],
        ['text', 'a'],
        ['paren', ')'],
      ]);
    });

    it('draws a dash inside a word as part of the word', () => {
      expect(readAs('well-known')).toEqual([['text', 'well-known']]);
    });

    it('draws a word that is only an operator inside a phrase as a phrase', () => {
      expect(readAs('"and"')).toEqual([['phrase', '"and"']]);
    });

    it('keeps the blanks between tokens, all of them, and at either end', () => {
      expect(readAs('  a \t b  ')).toEqual([
        ['blank', '  '],
        ['text', 'a'],
        ['blank', ' \t '],
        ['text', 'b'],
        ['blank', '  '],
      ]);
    });

    it('gives nothing for an empty text', () => {
      expect(readAs('')).toEqual([]);
    });

    it('draws a text of blanks only as one blank', () => {
      expect(readAs('   ')).toEqual([['blank', '   ']]);
    });
  });

  describe('the severity of each piece', () => {
    it('gives none to a piece no diagnostic covers', () => {
      expect(marked('a b', [])).toEqual([
        ['a', undefined],
        [' ', undefined],
        ['b', undefined],
      ]);
      expect(syntaxSegments('a', tokenize('a'), []).every((segment) => !('severity' in segment))).toBe(true);
    });

    it('marks the text a diagnostic is about and cuts a piece where the diagnostic ends', () => {
      // The unknown field is the letters of its name, not the colon after them (QUERY_LANGUAGE §5).
      expect(marked('clas:life', [diagnostic('error', [0, 4])])).toEqual([
        ['clas', 'error'],
        [':', undefined],
        ['life', undefined],
      ]);
    });

    it('cuts a piece where a diagnostic starts inside it', () => {
      expect(marked('class:life', [diagnostic('warning', [6, 10])])).toEqual([
        ['class:', undefined],
        ['life', 'warning'],
      ]);
      expect(marked('abcdef', [diagnostic('error', [2, 4])])).toEqual([
        ['ab', undefined],
        ['cd', 'error'],
        ['ef', undefined],
      ]);
    });

    it('marks every piece a diagnostic runs over, the blanks between them too', () => {
      expect(marked('( )', [diagnostic('error', [0, 3])])).toEqual([
        ['(', 'error'],
        [' ', 'error'],
        [')', 'error'],
      ]);
    });

    it('gives a piece the worse of the two when an error and a warning cover it', () => {
      expect(marked('weak', [diagnostic('warning', [0, 4]), diagnostic('error', [1, 3])])).toEqual([
        ['w', 'warning'],
        ['ea', 'error'],
        ['k', 'warning'],
      ]);
      expect(marked('weak', [diagnostic('error', [0, 4]), diagnostic('warning', [0, 4])])).toEqual([['weak', 'error']]);
    });

    it('does not cut a piece for two diagnostics of one severity that meet', () => {
      expect(marked('abcd', [diagnostic('error', [0, 2]), diagnostic('error', [2, 4])])).toEqual([['abcd', 'error']]);
    });

    it('ignores a diagnostic that covers no text', () => {
      expect(marked('a b', [diagnostic('error', [1, 1]), diagnostic('error', [3, 3])])).toEqual([
        ['a', undefined],
        [' ', undefined],
        ['b', undefined],
      ]);
    });

    it('does not depend on the order the diagnostics are given in', () => {
      const diagnostics = [diagnostic('warning', [4, 6]), diagnostic('error', [0, 2]), diagnostic('error', [5, 7])];
      expect(marked('ab cd ef', diagnostics)).toEqual(marked('ab cd ef', [...diagnostics].reverse()));
    });
  });

  describe('properties, on any text', () => {
    it('are pieces of the text in order that, put together, are the text', () => {
      fc.assert(
        fc.property(queryText, (source) => {
          const segments = segmentsOf(source);
          expect(segments.map(({ text }) => text).join('')).toBe(source);
          let at = 0;
          for (const {
            span: [start, end],
            text,
          } of segments) {
            expect(start).toBe(at);
            expect(source.slice(start, end)).toBe(text);
            at = end;
          }
          expect(at).toBe(source.length);
        }),
      );
    });

    it('are never empty', () => {
      fc.assert(
        fc.property(queryText, (source) => {
          for (const { text } of segmentsOf(source)) expect(text).not.toBe('');
        }),
      );
    });

    it('never run over two tokens: a piece is inside one token or inside the blanks between them', () => {
      fc.assert(
        fc.property(queryText, (source) => {
          const tokens = tokenize(source);
          for (const {
            span: [start, end],
            kind,
          } of segmentsOf(source)) {
            const inside = tokens.filter(({ span }) => span[0] < end && start < span[1]);
            if (kind === 'blank') expect(inside).toEqual([]);
            else {
              expect(inside).toHaveLength(1);
              expect(inside[0]?.span[0]).toBeLessThanOrEqual(start);
              expect(inside[0]?.span[1]).toBeGreaterThanOrEqual(end);
            }
          }
        }),
      );
    });

    it('are the same pieces whatever the diagnostics are, but for where they are cut', () => {
      fc.assert(
        fc.property(queryText, (source) => {
          const parsed = parseQuery(source);
          const plain = segmentsOf(source);
          const cut = syntaxSegments(source, parsed.tokens, parsed.diagnostics);
          expect(cut.map(({ text }) => text).join('')).toBe(source);
          // Every cut piece lies inside a plain one of the same kind, and a plain piece is cut into whole pieces only.
          for (const {
            span: [start, end],
            kind,
          } of cut) {
            const home = plain.find(({ span }) => span[0] <= start && end <= span[1]);
            expect(home?.kind).toBe(kind);
          }
        }),
      );
    });

    it('give each character the worst severity of the diagnostics over it', () => {
      const spanWithin = (length: number) =>
        fc
          .tuple(fc.integer({ min: 0, max: length }), fc.integer({ min: 0, max: length }))
          .map(([a, b]): Span => [Math.min(a, b), Math.max(a, b)]);
      const case_ = queryText.chain((source) =>
        fc.tuple(
          fc.constant(source),
          fc.array(
            fc.tuple(fc.constantFrom<QueryDiagnostic['severity']>('error', 'warning'), spanWithin(source.length)),
            { maxLength: 6 },
          ),
        ),
      );

      fc.assert(
        fc.property(case_, ([source, found]) => {
          const diagnostics = found.map(([severity, span]) => diagnostic(severity, span));
          const segments = syntaxSegments(source, tokenize(source), diagnostics);
          expect(segments.map(({ text }) => text).join('')).toBe(source);

          for (const {
            span: [start, end],
            severity,
          } of segments) {
            for (let at = start; at < end; at++) {
              const covering = found.filter(([, [from, to]]) => from <= at && at < to).map(([kind]) => kind);
              const worst = covering.includes('error') ? 'error' : covering.includes('warning') ? 'warning' : undefined;
              expect(severity).toBe(worst);
            }
          }
        }),
      );
    });
  });

  // 100,000 stray parentheses are 100,000 diagnostics over 200,000 pieces: a walk that compared each piece with each diagnostic
  // would need minutes, this one a few tens of milliseconds.
  it('reads a long text of faults in a moment', { timeout: 2000 }, () => {
    const source = ') '.repeat(100_000);
    const parsed = parseQuery(source);
    const segments = syntaxSegments(source, parsed.tokens, parsed.diagnostics);
    expect(segments.map(({ text }) => text).join('')).toBe(source);
  });
});
