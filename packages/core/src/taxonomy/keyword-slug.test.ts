import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { keywordFromSlug, keywordSlug } from './keyword-slug';
import { taxonomy } from './taxonomy';

describe('keywordSlug', () => {
  it.each([
    ['poisoned', 'poisoned'],
    ['mega magic', 'mega-magic'],
    ['dire wolves', 'dire-wolves'],
    ['start of battle', 'start-of-battle'],
  ])('writes the key %j as %j', (key, slug) => {
    expect(keywordSlug(key)).toBe(slug);
  });

  it('is safe to put in a path: lower case letters, digits and single hyphens', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (key) => {
        expect(keywordSlug(key)).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/u);
      }),
    );
  });
});

describe('keywordFromSlug', () => {
  const keys = ['poisoned', 'mega magic', 'weak'];

  it('finds the key a slug stands for', () => {
    expect(keywordFromSlug('mega-magic', keys)).toBe('mega magic');
    expect(keywordFromSlug('weak', keys)).toBe('weak');
  });

  it('knows nothing of a slug no key writes', () => {
    expect(keywordFromSlug('stunned', keys)).toBeUndefined();
    expect(keywordFromSlug('', keys)).toBeUndefined();
  });

  // One page, one address: a slug that is only the key as it is typed is not a second way to reach it.
  it('reads the slug exactly: the key as typed, with a space or a capital, is not one', () => {
    expect(keywordFromSlug('mega magic', keys)).toBeUndefined();
    expect(keywordFromSlug('Weak', keys)).toBeUndefined();
  });

  it('knows nothing of a key it is not given, whatever the taxonomy says', () => {
    expect(keywordFromSlug('attack', keys)).toBeUndefined();
  });

  it('gives back every key of the taxonomy from its own slug', () => {
    const everyKey = taxonomy.entries.map(({ key }) => key);

    expect(everyKey.map((key) => keywordFromSlug(keywordSlug(key), everyKey))).toEqual(everyKey);
  });
});
