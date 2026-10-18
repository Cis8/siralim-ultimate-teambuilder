import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { taxonomy } from '../taxonomy/taxonomy';
import { fieldRegistry } from './fields';
import type { LintContext } from './lint-rule';
import { lintRegistry } from './lint-rules';
import { checkTerm, MAX_REMEMBERED_TEXTS } from './lint-term';
import { parseQuery } from './parser';
import type { TermToken } from './token';

/** The pretend dataset finds a trait for these texts only. */
const FOUND = new Set(['weak', 'snared', 'life']);

const makeContext = (
  hits: LintContext['hits'] = (term) => (FOUND.has(term.value.toLowerCase()) ? 3 : 0),
): LintContext => ({
  fields: fieldRegistry,
  taxonomy,
  vocabulary: {
    class: ['Chaos', 'Death', 'Life', 'Nature'],
    family: ['Abomination', 'Clutcher'],
    creature: ['Abomination Brute', 'Clutcher Bruiser'],
    name: ['Flesh Rot', 'Last Stand'],
  },
  hits,
});

/** The terms of a text, with the spans they have in it. */
const termsOf = (source: string): TermToken[] =>
  parseQuery(source).tokens.filter((token): token is TermToken => token.kind === 'term');

const lastTerm = (source: string): TermToken => {
  const term = termsOf(source).at(-1);
  if (term === undefined) throw new Error(`${JSON.stringify(source)} has no term`);
  return term;
};

describe('checkTerm', () => {
  const TERMS = [
    'weak',
    'zzzz',
    'class:lfe',
    'clas:life',
    'mat:maybe',
    'applies:vulnrable',
    'uses:attack/nobody',
    '"no such"',
  ];

  it.each(TERMS)('gives what the rules give about %j, the first time and every time after', (source) => {
    const context = makeContext();
    const term = lastTerm(source);

    for (const typing of [false, true]) {
      const expected = lintRegistry.check(term, makeContext(), { typing });
      expect(checkTerm(term, context, typing)).toEqual(expected);
      expect(checkTerm(term, context, typing)).toEqual(expected);
    }
  });

  it('asks the rules once for a text, however often it is linted and wherever it stands', () => {
    const hits = vi.fn(makeContext().hits);
    const context = makeContext(hits);

    checkTerm(lastTerm('zzzz'), context, false);
    checkTerm(lastTerm('zzzz'), context, false);
    for (const term of termsOf('weak zzzz AND zzzz')) checkTerm(term, context, false);

    // `hits` is asked for each text that has no field: `zzzz` once, and `weak` once.
    expect(hits.mock.calls.map(([term]) => term.value)).toEqual(['zzzz', 'weak']);
  });

  it('puts the findings where the text stands now, the span of the fix too', () => {
    const context = makeContext();
    const [first] = checkTerm(lastTerm('class:lfe'), context, false);
    const [moved] = checkTerm(lastTerm('weak OR snared class:lfe'), context, false);

    expect(first?.span).toEqual([6, 9]);
    expect(first?.fix?.edit).toEqual({ span: [6, 9], text: 'Life' });
    // The term starts at 15 in the longer text, 15 further on than where it was remembered.
    expect(moved?.span).toEqual([21, 24]);
    expect(moved?.fix?.edit).toEqual({ span: [21, 24], text: 'Life' });
    expect(moved?.message).toBe(first?.message);
    expect(moved?.fix?.label).toBe(first?.fix?.label);
  });

  it('does not change what it remembered when it moves a finding', () => {
    const context = makeContext();
    checkTerm(lastTerm('class:lfe'), context, false);

    const [moved] = checkTerm(lastTerm('weak class:lfe'), context, false);
    const [again] = checkTerm(lastTerm('class:lfe'), context, false);

    expect(moved?.span).toEqual([11, 14]);
    expect(again?.span).toEqual([6, 9]);
  });

  it('keeps a term being typed apart from the same text when it is finished', () => {
    const term = lastTerm('class:lf');
    const codesOf = (context: LintContext, typing: boolean): string[] =>
      checkTerm(term, context, typing).map(({ code }) => code);

    const typingFirst = makeContext();
    expect(codesOf(typingFirst, true)).toEqual([]);
    expect(codesOf(typingFirst, false)).toEqual(['unknown-class']);

    const finishedFirst = makeContext();
    expect(codesOf(finishedFirst, false)).toEqual(['unknown-class']);
    expect(codesOf(finishedFirst, true)).toEqual([]);
  });

  it('remembers for one context only: another dataset answers for itself', () => {
    const finding = makeContext(() => 5);
    const noFinding = makeContext(() => 0);
    const term = lastTerm('zzzz');

    expect(checkTerm(term, finding, false)).toEqual([]);
    expect(checkTerm(term, noFinding, false).map(({ code }) => code)).toEqual(['text-in-no-trait']);
    expect(checkTerm(term, finding, false)).toEqual([]);
  });

  it('forgets the lot when it holds too many texts, and gives the same answers after', () => {
    const hits = vi.fn(makeContext().hits);
    const context = makeContext(hits);
    const word = (at: number): TermToken => lastTerm(`qxqxqxqx${String(at)}`);

    for (let at = 0; at < MAX_REMEMBERED_TEXTS; at += 1) checkTerm(word(at), context, false);
    expect(hits).toHaveBeenCalledTimes(MAX_REMEMBERED_TEXTS);
    checkTerm(word(0), context, false);
    expect(hits).toHaveBeenCalledTimes(MAX_REMEMBERED_TEXTS);

    checkTerm(word(MAX_REMEMBERED_TEXTS), context, false);
    checkTerm(word(0), context, false);
    expect(hits).toHaveBeenCalledTimes(MAX_REMEMBERED_TEXTS + 2);
    expect(checkTerm(word(0), context, false).map(({ code }) => code)).toEqual(['text-in-no-trait']);
  });

  it('gives the same findings from a context that has seen other texts as from a new one, wherever the text stands', () => {
    const fragment = fc.constantFrom(
      'weak',
      'clas:life',
      'class:lfe',
      'applies:vulnrable',
      'uses:weak/self',
      'mat:maybe',
      'vulnrable',
      '"no such"',
      'zzzz',
    );
    const text = fc
      .tuple(fc.array(fragment, { minLength: 1, maxLength: 5 }), fc.constantFrom(' ', '  ', ' OR '))
      .map(([parts, joiner]) => parts.join(joiner));
    const shared = makeContext();

    fc.assert(
      fc.property(text, fc.boolean(), (source, typing) => {
        for (const term of termsOf(source)) {
          expect(checkTerm(term, shared, typing)).toEqual(lintRegistry.check(term, makeContext(), { typing }));
        }
      }),
    );
  });
});
