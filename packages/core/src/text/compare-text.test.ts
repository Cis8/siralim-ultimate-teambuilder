import { describe, expect, it } from 'vitest';
import { compareText } from './compare-text';

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
