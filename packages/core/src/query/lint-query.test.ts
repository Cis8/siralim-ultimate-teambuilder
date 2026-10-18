import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { taxonomy } from '../taxonomy/taxonomy';
import type { QueryDiagnostic } from './diagnostic';
import { fieldRegistry } from './fields';
import type { LintContext } from './lint-rule';
import { lintQuery, MAX_LINTED_LENGTH } from './lint-query';
import { applyEdit } from './text-edit';

/** The pretend dataset finds a trait for these texts only. */
const FOUND = new Set(['weak', 'snared', 'life', 'vulnerable']);

const context: LintContext = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: {
    class: ['Chaos', 'Death', 'Life', 'Nature'],
    family: ['Abomination', 'Clutcher'],
    creature: ['Abomination Brute', 'Clutcher Bruiser'],
    name: ['Flesh Rot', 'Last Stand'],
  },
  hits: (term) => (FOUND.has(term.value.toLowerCase()) ? 3 : 0),
};

const codes = (diagnostics: readonly QueryDiagnostic[]): string[] => diagnostics.map(({ code }) => code);

/** Fixes the first diagnostic that has a fix, again and again, as far as that goes. */
function mended(source: string, limit = 40): string {
  let text = source;
  for (let step = 0; step < limit; step += 1) {
    const fix = lintQuery(text, context).find((diagnostic) => diagnostic.fix !== undefined)?.fix;
    if (fix === undefined) return text;
    text = applyEdit(text, fix.edit);
  }
  throw new Error(`${JSON.stringify(source)} still had a fix after ${String(limit)} of them`);
}

describe('lintQuery', () => {
  it.each([
    '',
    '   ',
    'weak',
    '(weak OR snared) -stack:no',
    'class:life applies:vulnerable/ ',
    'u:attack/self -mat:no',
  ])('finds nothing in %j', (source) => {
    expect(lintQuery(source, context)).toEqual([]);
  });

  describe('criterion 1 of Phase 2', () => {
    const source = 'clas:life (weak OR snared';

    it('shows two errors, each with a fix', () => {
      const found = lintQuery(source, context);

      expect(found.map(({ code, severity, span }) => [code, severity, span])).toEqual([
        ['unknown-field', 'error', [0, 4]],
        ['unclosed-open', 'error', [10, 11]],
      ]);
      expect(found.map((diagnostic) => diagnostic.fix?.label)).toEqual(['Change to “class:”', 'Add the missing “)”']);
    });

    it('ends with a query that is read without a repair or a finding, whichever fix is made first', () => {
      const [field, group] = lintQuery(source, context);
      if (field?.fix === undefined || group?.fix === undefined) throw new Error('Both have a fix');

      const fieldFirst = applyEdit(source, field.fix.edit);
      const groupFirst = applyEdit(source, group.fix.edit);

      expect(lintQuery(fieldFirst, context).map(({ code }) => code)).toEqual(['unclosed-open']);
      expect(lintQuery(groupFirst, context).map(({ code }) => code)).toEqual(['unknown-field']);
      expect(mended(source)).toBe('class:life (weak OR snared)');
      expect(lintQuery(mended(source), context)).toEqual([]);
      expect(mended(groupFirst)).toBe('class:life (weak OR snared)');
    });
  });

  describe('what it gives', () => {
    it('is the diagnostics of the parser, with their fixes, and the findings of the rules', () => {
      const found = lintQuery('weak) class:lfe', context);

      expect(found.map(({ code, fix }) => [code, fix?.edit])).toEqual([
        ['unmatched-close', { span: [4, 5], text: '' }],
        ['unknown-class', { span: [12, 15], text: 'Life' }],
      ]);
    });

    it('puts them in the order of the text, not the parser first', () => {
      const found = lintQuery('clas:life )', context);

      expect(found.map(({ code, span }) => [code, span])).toEqual([
        ['unknown-field', [0, 4]],
        ['unmatched-close', [10, 11]],
      ]);
    });

    it('puts what the parser found before a finding about the very same text', () => {
      const found = lintQuery('"unfinished', context);

      expect(found.map(({ code, span }) => [code, span])).toEqual([
        ['unclosed-quote', [0, 11]],
        ['text-in-no-trait', [0, 11]],
      ]);
    });

    it('looks at every term, in a group or under a NOT as well', () => {
      expect(codes(lintQuery('-(clas:life OR mat:maybe) zzzz', context))).toEqual([
        'unknown-field',
        'invalid-choice',
        'text-in-no-trait',
      ]);
    });

    it('gives a finding for every place the same text stands', () => {
      const found = lintQuery('zzzz zzzz', context);

      expect(found.map(({ span }) => span)).toEqual([
        [0, 4],
        [5, 9],
      ]);
    });
  });

  describe('a text that is too long', () => {
    const padded = (length: number): string => `clas:${'a'.repeat(length - 5)}`;

    it('is linted up to the limit, and not past it: the work grows with the length and the fixes with its square', () => {
      expect(MAX_LINTED_LENGTH).toBe(2000);
      expect(codes(lintQuery(padded(MAX_LINTED_LENGTH), context))).toEqual(['unknown-field']);
      expect(lintQuery(padded(MAX_LINTED_LENGTH + 1), context)).toEqual([]);
    });

    it('still tells what the parser found, without fixes: that is cheap, and it is as true', () => {
      const found = lintQuery(`${'clas:life '.repeat(250)})`, context);

      expect(found.map(({ code, fix }) => [code, fix])).toEqual([['unmatched-close', undefined]]);
    });
  });

  describe('a term the person is still typing (D20)', () => {
    it.each([
      ['class:lf', 8, []],
      ['class:lf', 7, []],
      ['class:lf', 6, []],
      ['class:lf', 0, []],
      ['weak class:lf', 13, []],
      ['(class:lf)', 9, []],
      ['vulnrable', 9, []],
      ['applies:', 8, []],
      ['mat:maybe', 9, []],
      ['"unclosed', 9, ['unclosed-quote']],
      ['class:lf)', 8, ['unmatched-close']],
    ])('holds back the findings about the term in %j with the caret at %i', (source, caret, expected) => {
      expect(codes(lintQuery(source, context, { caret }))).toEqual(expected);
    });

    it.each([
      ['class:lf', undefined, ['unknown-class']],
      ['class:lf weak', 8, ['unknown-class']],
      ['class:lf weak', 3, ['unknown-class']],
      ['class:lf weak', 13, ['unknown-class']],
      ['class:lf OR weak', 16, ['unknown-class']],
      ['applies: weak', 8, ['empty-value']],
      ['vulnrable weak', 9, ['text-in-no-trait']],
      ['class:lf', 9, ['unknown-class']],
    ])(
      'gives them for %j with the caret at %s: the term is finished, or the caret is elsewhere',
      (source, caret, expected) => {
        expect(codes(lintQuery(source, context, caret === undefined ? {} : { caret }))).toEqual(expected);
      },
    );

    it('gives the findings about a field that does not exist at once: its colon is what makes it complete', () => {
      expect(codes(lintQuery('clas:li', context, { caret: 7 }))).toEqual(['unknown-field']);
      expect(codes(lintQuery('clas:', context, { caret: 5 }))).toEqual(['unknown-field']);
    });

    it('holds back only the term the caret is in', () => {
      expect(codes(lintQuery('mat:maybe vulnrable', context, { caret: 19 }))).toEqual(['invalid-choice']);
    });

    it('does not work out what it holds back', () => {
      const hits = vi.fn(context.hits);

      lintQuery('vulnr', { ...context, hits }, { caret: 5 });
      expect(hits).not.toHaveBeenCalled();

      lintQuery('vulnr', { ...context, hits });
      expect(hits).toHaveBeenCalled();
    });
  });

  describe('for any text', () => {
    const fragment = fc.constantFrom(
      'weak',
      'clas:life',
      'class:lfe',
      'applies:vulnrable',
      'uses:weak/self',
      'u:attack/selff',
      'kw:timeline',
      'a:timeline',
      'mat:maybe',
      'applies:',
      'vulnrable',
      '"unclosed',
      '(',
      ')',
      ' OR ',
      ' AND ',
      '-',
      ' ',
    );
    const text = fc.array(fragment, { maxLength: 6 }).map((parts) => parts.join(''));

    it('gives diagnostics inside the text, in the order of the text, each with a fix that stays inside it', () => {
      fc.assert(
        fc.property(text, fc.nat(80), (source, caret) => {
          const found = lintQuery(source, context, { caret: Math.min(caret, source.length) });

          for (const { span, fix } of found) {
            expect(span[0]).toBeGreaterThanOrEqual(0);
            expect(span[0]).toBeLessThanOrEqual(span[1]);
            expect(span[1]).toBeLessThanOrEqual(source.length);
            if (fix !== undefined) expect(fix.edit.span[1]).toBeLessThanOrEqual(source.length);
          }
          expect(found.map(({ span }) => span[0])).toEqual(found.map(({ span }) => span[0]).sort((a, b) => a - b));
        }),
      );
    });

    it('is mended, by fixing the first diagnostic that has a fix again and again, to a text with no fix left', () => {
      fc.assert(
        fc.property(text, (source) => {
          const result = mended(source);

          expect(lintQuery(result, context).filter(({ fix }) => fix !== undefined)).toEqual([]);
        }),
      );
    });
  });
});
