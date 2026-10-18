import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { QueryDiagnostic, SyntaxDiagnosticCode } from './diagnostic';
import { MAX_NESTING, parseQuery } from './parser';
import { serialise } from './serialise';
import { MAX_FIXABLE_DIAGNOSTICS, withSyntaxFixes } from './syntax-fixes';
import { applyEdit } from './text-edit';

/** What the field shows for a text: the parser's diagnostics, each with the fix this module gives it. */
function diagnose(source: string): QueryDiagnostic<SyntaxDiagnosticCode>[] {
  return withSyntaxFixes(source, parseQuery(source));
}

const codesOf = (source: string): SyntaxDiagnosticCode[] => diagnose(source).map(({ code }) => code);

/** The text after the first diagnostic of `code` that has a fix is fixed. */
function fixed(source: string, code: SyntaxDiagnosticCode): string {
  const fix = diagnose(source).find((diagnostic) => diagnostic.code === code && diagnostic.fix !== undefined)?.fix;
  if (fix === undefined) throw new Error(`${JSON.stringify(source)} has no fix for ${code}`);
  return applyEdit(source, fix.edit);
}

/** The first fix the field offers, or `undefined` for a text with none to give. */
function firstFix(source: string) {
  return diagnose(source).find(({ fix }) => fix !== undefined)?.fix;
}

describe('withSyntaxFixes', () => {
  it('gives a text the parser reads without repairs no diagnostic at all', () => {
    expect(diagnose('')).toEqual([]);
    expect(diagnose('(weak OR snared) -class:life "two words"')).toEqual([]);
  });

  it('keeps what the parser reported as it was, and adds the fix', () => {
    const source = '(a OR';
    const parsed = parseQuery(source);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    const reported = withSyntaxFixes(source, parsed).map(({ code, severity, span, message }) => ({
      code,
      severity,
      span,
      message,
    }));
    expect(reported).toEqual(parsed.diagnostics);
  });

  describe('each code is fixed by removing the text at fault and one blank next to it', () => {
    describe('unmatched-close', () => {
      it.each([
        ['a ) b', 'a b'],
        [') a', 'a'],
        ['a )', 'a'],
        ['(a))', '(a)'],
        ['a ) OR b', 'a OR b'],
        ['  a  )  b  ', '  a  b  '],
        // Without a blank the two words would be one: a space takes the place of the parenthesis.
        ['a)b', 'a b'],
        // And a field would take the next word for its value.
        ['class:)a', 'class: a'],
        ['-)a', '-a'],
      ])('%j becomes %j', (source, expected) => {
        expect(fixed(source, 'unmatched-close')).toBe(expected);
      });
    });

    describe('dangling-operator', () => {
      it.each([
        ['a OR', 'a'],
        ['a or', 'a'],
        ['OR a', 'a'],
        ['OR', ''],
        ['a AND', 'a'],
        ['a & b |', 'a & b'],
        ['a OR OR b', 'a OR b'],
        ['a | | b', 'a | b'],
        ['a AND OR b', 'a OR b'],
        ['(OR a)', '(a)'],
        ['(a OR)', '(a)'],
      ])('%j becomes %j', (source, expected) => {
        expect(fixed(source, 'dangling-operator')).toBe(expected);
      });
    });

    describe('missing-operand', () => {
      it.each([
        ['a NOT', 'a'],
        ['a -', 'a'],
        ['NOT', ''],
        ['(a -)', '(a)'],
        ['a - OR b', 'a OR b'],
      ])('%j becomes %j', (source, expected) => {
        expect(fixed(source, 'missing-operand')).toBe(expected);
      });
    });

    describe('empty-group', () => {
      it.each([
        ['()', ''],
        ['a () b', 'a b'],
        ['a ( ) b', 'a b'],
        ['a ()', 'a'],
        // What stood in the group goes with it: there is no NOT left to complain about.
        ['(NOT)', ''],
      ])('%j becomes %j', (source, expected) => {
        expect(fixed(source, 'empty-group')).toBe(expected);
      });
    });

    describe('nested-too-deeply', () => {
      it('removes the parenthesis past the limit, and the one that closed it is reported on its own', () => {
        const source = `${'('.repeat(MAX_NESTING + 1)}a${')'.repeat(MAX_NESTING + 1)}`;
        const after = fixed(source, 'nested-too-deeply');
        expect(after).toBe(`${'('.repeat(MAX_NESTING)}a${')'.repeat(MAX_NESTING + 1)}`);
        expect(codesOf(after)).toEqual(['unmatched-close']);
      });

      it('removes a NOT past the limit', () => {
        const source = `${'-'.repeat(MAX_NESTING + 1)}a`;
        expect(fixed(source, 'nested-too-deeply')).toBe(`${'-'.repeat(MAX_NESTING)}a`);
      });
    });
  });

  describe('a missing ) is added at the end', () => {
    it.each([
      ['(a', '(a)'],
      ['(a OR b', '(a OR b)'],
      ['-(a', '-(a)'],
      ['(a (b)', '(a (b))'],
      // The text outside the edit stays as typed, a trailing blank included.
      ['(a ', '(a )'],
    ])('%j becomes %j', (source, expected) => {
      expect(fixed(source, 'unclosed-open')).toBe(expected);
    });

    it('closes the innermost group first: the ) would close that one, so the outer ones wait', () => {
      expect(diagnose('((a').map(({ code, fix }) => [code, fix !== undefined])).toEqual([
        ['unclosed-open', false],
        ['unclosed-open', true],
      ]);
      const once = fixed('((a', 'unclosed-open');
      expect(once).toBe('((a)');
      expect(diagnose(once).map(({ code, fix }) => [code, fix !== undefined])).toEqual([['unclosed-open', true]]);
      expect(fixed(once, 'unclosed-open')).toBe('((a))');
    });
  });

  describe('a ( with nothing in it is not closed into an empty (), it is removed', () => {
    it.each([
      ['(', ''],
      ['a (', 'a'],
      ['( OR', 'OR'],
      ['-(', '-'],
      ['((', '('],
      ['( a (', '( a'],
      ['( ( )', '( )'],
    ])('%j becomes %j', (source, expected) => {
      expect(fixed(source, 'unclosed-open')).toBe(expected);
    });

    it('closes the ( that has something in it, once the empty one inside it is gone', () => {
      expect(diagnose('( a (').map(({ code, fix }) => [code, fix !== undefined])).toEqual([
        ['unclosed-open', false],
        ['unclosed-open', true],
      ]);
      expect(fixed(fixed('( a (', 'unclosed-open'), 'unclosed-open')).toBe('( a)');
    });
  });

  describe('a quote left open is closed at the end', () => {
    it.each([
      ['"two words', '"two words"'],
      ['class:"rodian', 'class:"rodian"'],
      ['a OR "b', 'a OR "b"'],
      ['a "b ', 'a "b "'],
      ['"', '""'],
    ])('%j becomes %j', (source, expected) => {
      expect(fixed(source, 'unclosed-quote')).toBe(expected);
    });
  });

  describe('a quote left open swallows the rest of the text, parentheses included', () => {
    it('so a ) added before the quote is closed would only end up inside it, and is not offered', () => {
      const diagnostics = diagnose('(a "b');
      expect(diagnostics.map(({ code, fix }) => [code, fix !== undefined])).toEqual([
        ['unclosed-open', false],
        ['unclosed-quote', true],
      ]);
    });

    it('is offered once the quote is closed', () => {
      const closed = fixed('(a "b', 'unclosed-quote');
      expect(closed).toBe('(a "b"');
      expect(fixed(closed, 'unclosed-open')).toBe('(a "b")');
    });
  });

  describe('a text with more problems than it is worth mending one by one', () => {
    it('is given fixes up to the limit and none past it', () => {
      const atTheLimit = diagnose(')'.repeat(MAX_FIXABLE_DIAGNOSTICS));
      expect(atTheLimit).toHaveLength(MAX_FIXABLE_DIAGNOSTICS);
      expect(atTheLimit.every(({ fix }) => fix !== undefined)).toBe(true);

      const past = diagnose(')'.repeat(MAX_FIXABLE_DIAGNOSTICS + 1));
      expect(past).toHaveLength(MAX_FIXABLE_DIAGNOSTICS + 1);
      expect(past.some(({ fix }) => fix !== undefined)).toBe(false);
    });

    it('is still reported in full, with the diagnostics the parser gave', () => {
      const source = ')'.repeat(MAX_FIXABLE_DIAGNOSTICS + 1);
      expect(diagnose(source)).toEqual(parseQuery(source).diagnostics);
    });
  });

  describe('a NOT with nothing to negate is mended before the text that stands in its way', () => {
    it.each([
      ['- AND a', 'dangling-operator', 'AND a', 'a'],
      ['NOT OR a', 'dangling-operator', 'OR a', 'a'],
      ['b -() a', 'empty-group', 'b () a', 'b a'],
      // The NOT binds across the ) that the parser skips as well.
      ['- ) AND a', 'dangling-operator', ') AND a', ') a'],
    ] as const)('%j: the NOT goes first', (source, code, withoutNot, final) => {
      // Fixing the operator or the group first would hand `a` to the NOT: `- a` is `-a`.
      expect(diagnose(source).find((diagnostic) => diagnostic.code === code)?.fix).toBeUndefined();
      const [first] = diagnose(source).filter(({ fix }) => fix !== undefined);
      expect(first?.code).toBe('missing-operand');
      expect(first?.fix === undefined ? undefined : applyEdit(source, first.fix.edit)).toBe(withoutNot);
      expect(fixed(withoutNot, code)).toBe(final);
    });
  });

  describe('labels say what the button does', () => {
    it.each([
      [')', 'Remove “)”'],
      ['(a', 'Add the missing “)”'],
      ['(', 'Remove “(”'],
      ['a OR', 'Remove “OR”'],
      ['a or', 'Remove “or”'],
      ['a |', 'Remove “|”'],
      ['a NOT', 'Remove “NOT”'],
      ['a -', 'Remove “-”'],
      ['()', 'Remove the empty group'],
      ['( )', 'Remove the empty group'],
      ['"a', 'Close the quote'],
    ])('%j: %j', (source, label) => {
      expect(diagnose(source)[0]?.fix?.label).toBe(label);
    });

    it('names the parenthesis that nests too deeply', () => {
      const source = `${'('.repeat(MAX_NESTING + 1)}a`;
      const diagnostic = diagnose(source).find(({ code }) => code === 'nested-too-deeply');
      expect(diagnostic?.fix?.label).toBe('Remove “(”');
    });
  });

  describe('for any text', () => {
    const piece = fc.constantFrom(
      '(',
      ')',
      '"',
      '-',
      'weak',
      'snared',
      'Class:life',
      'class:',
      'class:"rodian master"',
      '"two words"',
      '"and"',
      'OR',
      'AND',
      'NOT',
      '|',
      '&',
      'é',
    );
    // Mostly a blank between two pieces, sometimes none or more, so that pieces also touch: `(a)b`, `NOT(a`.
    const joined = fc.array(fc.tuple(piece, fc.constantFrom(' ', ' ', ' ', '', '  ')), { maxLength: 24 });
    const anyQuery = joined.map((parts) => parts.map(([text, blank]) => text + blank).join(''));
    const anyText = fc.oneof(anyQuery, anyQuery, fc.string({ unit: 'binary' }));

    /** The query as the parser reads it, which is the meaning of the text. */
    const meaning = (source: string): string => serialise(parseQuery(source).ast);

    it('changes only the text at fault and the blanks next to it', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          for (const { span, fix } of diagnose(source)) {
            if (fix === undefined) continue;
            const [start, end] = fix.edit.span;
            expect(start, JSON.stringify(source)).toBeLessThanOrEqual(end);
            expect(end, JSON.stringify(source)).toBeLessThanOrEqual(source.length);
            const removed = source.slice(start, end);
            // Whatever the edit takes out beyond the span of the diagnostic is blank.
            const outside = removed.replace(source.slice(span[0], span[1]), '');
            expect(outside.trim(), JSON.stringify(source)).toBe('');
            // Whatever it puts in is one blank, or the single character that was missing.
            expect([' ', ')', '"', ''], JSON.stringify(source)).toContain(fix.edit.text);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('reads the same query after any single fix, and with fewer problems', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const before = diagnose(source).length;
          for (const { code, fix } of diagnose(source)) {
            if (fix === undefined) continue;
            const after = applyEdit(source, fix.edit);
            expect(meaning(after), `${JSON.stringify(source)} ${code}`).toBe(meaning(source));
            expect(diagnose(after).length, `${JSON.stringify(source)} ${code}`).toBeLessThan(before);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('is clean after the first fix is applied again and again, in at most as many steps as it had problems', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          let text = source;
          for (let steps = diagnose(source).length; steps > 0; steps--) {
            const fix = firstFix(text);
            if (fix === undefined) break;
            text = applyEdit(text, fix.edit);
          }
          expect(diagnose(text), `${JSON.stringify(source)} ends as ${JSON.stringify(text)}`).toEqual([]);
        }),
        { numRuns: 500 },
      );
    });
  });
});
