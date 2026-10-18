import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from './field';
import { createFieldRegistry } from './field-registry';
import { createHighlighter } from './highlight';
import { parseQuery } from './parser';
import type { Span } from './span';

const highlighterFor = (query: string) => createHighlighter(parseQuery(query).ast);

/** The pieces of `text` the query marks, in order. */
function marked(query: string, text: string): string[] {
  return highlighterFor(query)(text).map(([start, end]) => text.slice(start, end));
}

/** Each term of the queries below is in it once. */
const TEXT = 'weak, snared and stunned';

const DESCRIPTION = 'Applies Weak. Weak creatures take more damage; stacks do not stack.';

describe('createHighlighter', () => {
  describe('the terms that are marked', () => {
    it('marks nothing for a query with no term', () => {
      expect(createHighlighter(undefined)(DESCRIPTION)).toEqual([]);
    });

    it('gives spans in the text, not HTML', () => {
      expect(highlighterFor('weak')(DESCRIPTION)).toEqual([
        [8, 12],
        [14, 18],
      ]);
    });

    it('marks a word with no field wherever the description has it', () => {
      expect(marked('weak', DESCRIPTION)).toEqual(['Weak', 'Weak']);
    });

    it('marks a part of a word, as the search finds it', () => {
      expect(marked('stack', DESCRIPTION)).toEqual(['stack', 'stack']);
    });

    it('marks a phrase as a whole', () => {
      expect(marked('"do not stack"', DESCRIPTION)).toEqual(['do not stack']);
      expect(marked('"not  stack"', DESCRIPTION)).toEqual([]);
    });

    it('marks the value of desc:, whatever the letter case of the query and of the text', () => {
      expect(marked('DESC:WEAK', DESCRIPTION)).toEqual(['Weak', 'Weak']);
      expect(marked('d:"more damage"', DESCRIPTION)).toEqual(['more damage']);
    });

    it('marks the whole token of a field nobody knows, which is what the search looks for', () => {
      expect(marked('clas:life', 'a clas:life b life')).toEqual(['clas:life']);
    });

    it.each(['class:weak', 'family:weak', 'creature:weak', 'trait:weak', 'applies:weak', 'uses:weak', 'kw:weak'])(
      'does not mark %s, which does not look in the description',
      (query) => {
        expect(marked(query, DESCRIPTION)).toEqual([]);
      },
    );

    it.each(['mat:yes', 'stack:no'])('does not mark %s, which has no text to show', (query) => {
      expect(marked(query, DESCRIPTION)).toEqual([]);
    });

    it.each(['""', 'desc:', 'desc:""', '"   "'])('does not mark %s, which asks for nothing', (query) => {
      expect(marked(query, DESCRIPTION)).toEqual([]);
    });

    it('marks nothing where the text does not have the term', () => {
      expect(marked('snared', DESCRIPTION)).toEqual([]);
    });

    it('takes a character that means something in a pattern for the character', () => {
      expect(marked('"1+1"', 'is 1+1 and 111 and 1.1')).toEqual(['1+1']);
      expect(marked('"1.1"', 'is 1+1 and 111 and 1.1')).toEqual(['1.1']);
      expect(marked('"[x]"', 'a [x] b x')).toEqual(['[x]']);
      expect(marked('"(x)"', 'a (x) b x')).toEqual(['(x)']);
      expect(marked('"a|b"', 'a b a|b')).toEqual(['a|b']);
      expect(marked('\\', 'a \\ b')).toEqual(['\\']);
    });
  });

  describe('the operators: only what a matching trait has to contain', () => {
    it.each([
      ['weak snared', ['weak', 'snared']],
      ['weak AND snared', ['weak', 'snared']],
      ['weak OR snared', ['weak', 'snared']],
      ['(weak OR snared) desc:stun', ['weak', 'snared', 'stun']],
      ['weak class:life', ['weak']],
    ])('marks the terms of %j', (query, expected) => {
      expect(marked(query, TEXT)).toEqual(expected);
    });

    it.each([
      ['-weak', []],
      ['NOT weak', []],
      ['-(weak OR snared)', []],
      ['-(weak snared)', []],
      ['weak -snared', ['weak']],
      ['-weak snared', ['snared']],
      ['-weak OR snared', ['snared']],
      ['-desc:weak', []],
      ['(weak -(snared stun)) OR stun', ['weak', 'stun']],
    ])('marks only the terms that are not under a NOT in %j', (query, expected) => {
      expect(marked(query, TEXT)).toEqual(expected);
    });

    // NOT NOT weak is weak: a trait found by it does have the word.
    it.each([
      ['--weak', ['weak']],
      ['NOT NOT weak', ['weak']],
      ['-(-weak)', ['weak']],
      ['---weak', []],
      ['-(snared -weak)', ['weak']],
      ['-(snared -(weak OR stun))', ['weak', 'stun']],
      ['-(snared -(-weak))', []],
    ])('marks a term under an even number of NOTs and not one under an odd number, as in %j', (query, expected) => {
      expect(marked(query, TEXT)).toEqual(expected);
    });
  });

  describe('the spans', () => {
    it('are in the order of the text, whatever the order of the query', () => {
      expect(highlighterFor('stunned weak')('weak and stunned')).toEqual([
        [0, 4],
        [9, 16],
      ]);
    });

    it('count a term once, however many times the query has it', () => {
      expect(highlighterFor('weak WEAK desc:weak')('a weak b')).toEqual([[2, 6]]);
    });

    it('join the terms that overlap', () => {
      expect(highlighterFor('weak eak aken')('weakened')).toEqual([[0, 6]]);
    });

    it('join the terms that touch, so that they make one mark', () => {
      expect(highlighterFor('wea ken')('weakened')).toEqual([[0, 6]]);
    });

    it('keep the terms that are apart', () => {
      expect(highlighterFor('wea ened')('weakened')).toEqual([
        [0, 3],
        [4, 8],
      ]);
    });

    it('are positions in the text as it is, though the lower case of a letter may be longer', () => {
      // "İ".toLowerCase() is two characters long: a search on the lower-cased text would be off by one.
      expect(highlighterFor('weak')('İ weak')).toEqual([[2, 6]]);
      expect(marked('weak', 'İ weak İ weak')).toEqual(['weak', 'weak']);
    });

    it('are found again in any text the highlighter is given', () => {
      const highlight = highlighterFor('weak');
      expect(highlight('weak')).toEqual([[0, 4]]);
      expect(highlight('not here')).toEqual([]);
      expect(highlight('')).toEqual([]);
      expect(highlight('weak weak')).toEqual([
        [0, 4],
        [5, 9],
      ]);
    });
  });

  describe('the fields of the registry', () => {
    const lookup =
      (matches: boolean): FieldDefinition['matcher'] =>
      () =>
      () =>
        matches;
    const field = (name: string, aliases: string[], rest: Partial<FieldDefinition> = {}): FieldDefinition => ({
      name,
      aliases,
      help: `the ${name}`,
      matcher: lookup(true),
      describe: (value) => `${name} is “${value}”`,
      ...rest,
    });
    const registry = createFieldRegistry(
      [
        field('story', ['s'], { highlightsDescription: true }),
        field('other', []),
        field('never', [], { highlightsDescription: false }),
      ],
      () => () => true,
    );
    const marksWith = (query: string) =>
      createHighlighter(parseQuery(query).ast, registry)('a story of an other, never, and a story');

    it('mark what a field that looks in the description asks for, under any of its names', () => {
      expect(marksWith('story:story')).toEqual([
        [2, 7],
        [34, 39],
      ]);
      expect(marksWith('s:story')).toEqual(marksWith('story:story'));
    });

    it('leave the others alone', () => {
      expect(marksWith('other:other')).toEqual([]);
      expect(marksWith('never:never')).toEqual([]);
    });

    it('read a word with no field as free text', () => {
      expect(marksWith('other')).toHaveLength(1);
    });
  });

  describe('for any query and any text', () => {
    const piece = fc.constantFrom('(', ')', '-', 'weak', 'a', 'desc:ak', 'class:a', 'OR', 'NOT', '"a b"', 'é', 'İ');
    const queryLike = fc.array(piece, { maxLength: 12 }).map((pieces) => pieces.join(' '));
    const text = fc
      .array(fc.constantFrom('weak', 'a', ' ', 'b', 'É', 'İ', 'AK'), { maxLength: 20 })
      .map((pieces) => pieces.join(''));

    it('gives spans that are in the text, in order, apart, and never empty', () => {
      fc.assert(
        fc.property(queryLike, text, (query, subject) => {
          const spans: readonly Span[] = highlighterFor(query)(subject);
          let end = -1;
          for (const [from, to] of spans) {
            expect(from).toBeGreaterThan(end);
            expect(to).toBeGreaterThan(from);
            expect(to).toBeLessThanOrEqual(subject.length);
            end = to;
          }
        }),
      );
    });

    it('does not throw, whatever the characters', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'binary' }), fc.string({ unit: 'binary' }), (query, subject) => {
          expect(() => highlighterFor(query)(subject)).not.toThrow();
        }),
      );
    });
  });
});
