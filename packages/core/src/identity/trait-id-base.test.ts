import { describe, expect, it } from 'vitest';
import { traitIdBase } from './trait-id-base';

describe('traitIdBase', () => {
  it('joins the slugs of family and trait name with a double hyphen', () => {
    expect(traitIdBase({ family: 'Abomination', name: 'Sin and Sentence' })).toBe('abomination--sin-and-sentence');
  });

  it('is the same for spellings that slugify alike', () => {
    expect(traitIdBase({ family: 'Dryad', name: "Mother's Love" })).toBe(
      traitIdBase({ family: 'Dryad', name: 'Mothers Love' }),
    );
  });

  it('names the offending field when nothing is left to build an id from', () => {
    expect(() => traitIdBase({ family: '???', name: 'Bite' })).toThrow(/family "\?\?\?"/);
    expect(() => traitIdBase({ family: 'Ant', name: '!!!' })).toThrow(/trait name "!!!"/);
  });
});
