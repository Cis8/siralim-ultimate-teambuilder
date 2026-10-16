import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it.each([
    ['Sin and Sentence', 'sin-and-sentence'],
    ['Abomination', 'abomination'],
    ['Rodian Master', 'rodian-master'],
    ['Wave 2', 'wave-2'],
  ])('lowercases and joins the words of %j with hyphens', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ["Mother's Wrath", 'mothers-wrath'],
    ['Mother’s Wrath', 'mothers-wrath'],
    ['Mother‘s Wrath', 'mothers-wrath'],
    ["Dragons' Hoard", 'dragons-hoard'],
  ])('drops apostrophes without splitting the word: %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ['Café Déjà Vu', 'cafe-deja-vu'],
    ['Crème Brûlée', 'creme-brulee'],
    ['Zoë', 'zoe'],
  ])('strips accents: %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ['Rock & Roll', 'rock-and-roll'],
    ['R&D', 'r-and-d'],
    ['Fire&Ice', 'fire-and-ice'],
  ])('reads & as "and": %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each([
    ['Wait!', 'wait'],
    ['Hello, World!!', 'hello-world'],
    ['Ready? Go!', 'ready-go'],
    ['@Home #1', 'home-1'],
    ['Half-Life', 'half-life'],
    ['Cost: $5', 'cost-5'],
  ])('turns other punctuation into a single separator: %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('collapses runs of whitespace and hyphens and trims both ends', () => {
    expect(slugify('  a   --  b \t\n')).toBe('a-b');
    expect(slugify('--edge--')).toBe('edge');
  });

  it('keeps digits', () => {
    expect(slugify('Level 10 Boss')).toBe('level-10-boss');
  });

  it('returns an empty string when nothing is left', () => {
    expect(slugify('')).toBe('');
    expect(slugify(' ?!# ')).toBe('');
  });

  describe('properties', () => {
    it('only ever emits hyphen-separated lowercase ASCII words', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'binary' }), (input) => {
          expect(slugify(input)).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/);
        }),
      );
    });

    it('is idempotent', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'binary' }), (input) => {
          const once = slugify(input);
          expect(slugify(once)).toBe(once);
        }),
      );
    });
  });
});
