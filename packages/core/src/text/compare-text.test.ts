import { describe, expect, it } from 'vitest';
import { compareText, compareTextIgnoringCase } from './compare-text';

describe('compareText', () => {
  it('orders by UTF-16 code unit, the same way everywhere', () => {
    expect(['b', 'B', 'a', 'A', '_', '1'].toSorted(compareText)).toEqual(['1', 'A', 'B', '_', 'a', 'b']);
  });

  it('puts a prefix before the longer text', () => {
    expect(compareText('abc', 'abcd')).toBeLessThan(0);
    expect(compareText('abcd', 'abc')).toBeGreaterThan(0);
  });

  it('returns 0 for equal text', () => {
    expect(compareText('same', 'same')).toBe(0);
  });

  it('does not follow the locale: an accented letter sorts after z', () => {
    expect(['é', 'z', 'a'].toSorted(compareText)).toEqual(['a', 'z', 'é']);
  });
});

describe('compareTextIgnoringCase', () => {
  it('orders the way a reader does: letter case does not decide', () => {
    expect(['Of the Beast', 'Offering', 'of old', 'Oak'].toSorted(compareTextIgnoringCase)).toEqual([
      'Oak',
      'of old',
      'Of the Beast',
      'Offering',
    ]);
  });

  it('puts a prefix before the longer text', () => {
    expect(compareTextIgnoringCase('Ab', 'abc')).toBeLessThan(0);
  });

  it('breaks a tie between texts that differ only in case, the same way every time', () => {
    expect(compareTextIgnoringCase('Ab', 'aB')).toBe(compareText('Ab', 'aB'));
    expect(compareTextIgnoringCase('aB', 'Ab')).toBe(-compareTextIgnoringCase('Ab', 'aB'));
  });

  it('returns 0 for equal text', () => {
    expect(compareTextIgnoringCase('Same', 'Same')).toBe(0);
  });
});
