import { describe, expect, it } from 'vitest';
import { lostTraitSearch } from './lost-trait-search';

describe('lostTraitSearch', () => {
  it('reads the name from what follows the family in the id, the hyphens turned into blanks', () => {
    expect(lostTraitSearch('abomination--sin-and-sentence').name).toBe('sin and sentence');
    expect(lostTraitSearch('gone--from-the-sheet').name).toBe('from the sheet');
  });

  it('searches the trait names for it', () => {
    expect(lostTraitSearch('abomination--sin-and-sentence').query).toBe('trait:"sin and sentence"');
  });

  it('keeps a digit, and a number that a collision suffix would add (SPEC §5)', () => {
    expect(lostTraitSearch('angel--seraph-2').name).toBe('seraph 2');
  });

  it('takes the whole id for the name when it has no family part', () => {
    expect(lostTraitSearch('not-a-slug-of-ours').name).toBe('not a slug of ours');
  });

  it('keeps what follows the first double hyphen only as words, however many there are', () => {
    expect(lostTraitSearch('a--b--c').name).toBe('b c');
  });

  it('has no name for an id with nothing after the family, and then nothing to search for', () => {
    expect(lostTraitSearch('family--')).toEqual({ name: '', query: '' });
    expect(lostTraitSearch('')).toEqual({ name: '', query: '' });
  });

  it('writes a query that cannot be broken by a quote that an unexpected id holds', () => {
    expect(lostTraitSearch('x--say-"hi"').query).toBe('trait:"say hi"');
  });
});
