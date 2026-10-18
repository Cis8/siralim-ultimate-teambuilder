import { describe, expect, it, vi } from 'vitest';
import { initialExploreState } from '../explore/explore-state';
import { fieldRegistry } from '../query/fields';
import { tokenize } from '../query/lexer';
import type { TermToken } from '../query/token';
import { taxonomy } from '../taxonomy/taxonomy';
import { createLintContext, type LintSource } from './lint-context';

const vocabulary = { class: ['Death', 'Life'], family: ['Wolf'], creature: ['Dire Wolf'], name: ['Bite'] };

function source(count: (query: string) => number = () => 0) {
  const countMatches = vi.fn<LintSource['countMatches']>((_state, query) => count(query));
  return { service: { vocabulary, countMatches } satisfies LintSource, countMatches };
}

function termOf(text: string): TermToken {
  const [only, ...others] = tokenize(text);
  if (only?.kind !== 'term' || others.length > 0) throw new Error(`${JSON.stringify(text)} is not one term`);
  return only;
}

describe('createLintContext', () => {
  it('gives the rules the fields, the taxonomy of the app and the vocabulary of the dataset', () => {
    const { service } = source();

    const context = createLintContext(service);

    expect(context.fields).toBe(fieldRegistry);
    expect(context.taxonomy).toBe(taxonomy);
    expect(context.vocabulary).toBe(vocabulary);
  });

  it('takes the fields and the taxonomy it is given', () => {
    const { service } = source();
    const otherTaxonomy = { ...taxonomy };

    const context = createLintContext(service, { taxonomy: otherTaxonomy });

    expect(context.taxonomy).toBe(otherTaxonomy);
    expect(context.fields).toBe(fieldRegistry);
  });

  describe('hits', () => {
    it('is the count of the traits the term finds in the whole dataset: with none of the filters of the page', () => {
      const { service, countMatches } = source(() => 42);

      expect(createLintContext(service).hits(termOf('class:life'))).toBe(42);
      expect(countMatches).toHaveBeenCalledExactlyOnceWith(initialExploreState, 'class:life');
    });

    it('asks for the term alone, written as the lexer reads it back', () => {
      const { service, countMatches } = source();
      const { hits } = createLintContext(service);

      hits(termOf('"two words"'));
      hits(termOf('desc:"dire wolf"'));
      hits(termOf('weak'));
      hits(termOf('class:"unclosed'));

      expect(countMatches.mock.calls.map(([, query]) => query)).toEqual([
        '"two words"',
        'desc:"dire wolf"',
        'weak',
        'class:unclosed',
      ]);
    });

    it('asks once for a field and a value, however often and however they are written', () => {
      const { service, countMatches } = source(() => 7);
      const { hits } = createLintContext(service);

      const counts = ['class:life', 'c:life', 'CLASS:LIFE', 'Class:"Life"', 'c:life'].map((text) => hits(termOf(text)));

      expect(counts).toEqual([7, 7, 7, 7, 7]);
      expect(countMatches).toHaveBeenCalledTimes(1);
    });

    it('tells fields and values apart', () => {
      const { service, countMatches } = source((query) => query.length);
      const { hits } = createLintContext(service);

      const asked = ['class:life', 'class:death', 'family:life', 'life', 'desc:life'].map((text) => hits(termOf(text)));

      expect(asked).toEqual([10, 11, 11, 4, 9]);
      expect(countMatches).toHaveBeenCalledTimes(5);
    });

    it('asks for a field nobody knows as the text it is, once for every way of writing it', () => {
      const { service, countMatches } = source(() => 0);
      const { hits } = createLintContext(service);

      hits(termOf('clas:life'));
      hits(termOf('CLAS:Life'));

      expect(countMatches).toHaveBeenCalledTimes(1);
      expect(countMatches.mock.calls[0]?.[1]).toBe('clas:life');
    });

    it('remembers a count of zero as well as any other', () => {
      const { service, countMatches } = source(() => 0);
      const { hits } = createLintContext(service);

      hits(termOf('zzz'));
      hits(termOf('zzz'));

      expect(countMatches).toHaveBeenCalledTimes(1);
    });

    it('does not share what it remembers with another context: the dataset may be another', () => {
      const { service, countMatches } = source();

      createLintContext(service).hits(termOf('weak'));
      createLintContext(service).hits(termOf('weak'));

      expect(countMatches).toHaveBeenCalledTimes(2);
    });
  });
});
