import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readList, writeList } from './url-params';

describe('writeList', () => {
  it('joins the items with commas', () => {
    expect(writeList(['life', 'nature'])).toBe('life,nature');
  });

  it('writes a comma or a percent sign inside an item as an escape, so that the item never splits in two', () => {
    expect(writeList(['a,b', '100%'])).toBe('a%2Cb,100%25');
  });

  it('keeps an empty item: it takes its place between two commas', () => {
    expect(writeList(['2.0', '', 'a'])).toBe('2.0,,a');
  });
});

describe('readList', () => {
  it('reads no list from a missing or an empty value', () => {
    expect(readList(null)).toEqual([]);
    expect(readList('')).toEqual([]);
  });

  it('splits at the commas and keeps the empty items', () => {
    expect(readList('2.0,,a,')).toEqual(['2.0', '', 'a', '']);
  });

  it('reads an escaped comma or percent sign as itself', () => {
    expect(readList('a%2Cb,100%25')).toEqual(['a,b', '100%']);
  });

  it('reads a percent sign that escapes nothing as itself', () => {
    expect(readList('%x,100%zz')).toEqual(['%x', '100%zz']);
  });
});

describe('a list written and read back', () => {
  it('is the list that was written, whatever the items hold', () => {
    const items = fc.array(fc.string(), { minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(
        // A list of one empty item is written as nothing at all, which reads as no list.
        items.filter((list) => !(list.length === 1 && list[0] === '')),
        (list) => {
          expect(readList(writeList(list))).toEqual(list);
        },
      ),
    );
  });
});
