import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normaliseText } from './normalise-text';

describe('normaliseText', () => {
  it('trims both ends', () => {
    expect(normaliseText('  Flesh Rot \t')).toBe('Flesh Rot');
  });

  it('collapses runs of spaces into one', () => {
    expect(normaliseText('Deals  10%   damage.')).toBe('Deals 10% damage.');
  });

  it.each([
    ['a non-breaking space', 'Deals damage'],
    ['a narrow no-break space', 'Deals damage'],
    ['a tab', 'Deals\tdamage'],
    ['a line break', 'Deals\ndamage'],
    ['a Windows line break', 'Deals\r\ndamage'],
    ['several mixed blanks', 'Deals  \n damage'],
  ])('reads %s as a plain space', (_label, input) => {
    expect(normaliseText(input)).toBe('Deals damage');
  });

  it.each([
    ['a right single quote', 'It’s'],
    ['a left single quote', 'It‘s'],
  ])('turns %s into a straight apostrophe', (_label, input) => {
    expect(normaliseText(input)).toBe("It's");
  });

  it('turns curly double quotes into straight ones', () => {
    expect(normaliseText('Says “hi” twice')).toBe('Says "hi" twice');
  });

  it('leaves everything else alone', () => {
    const text = 'Deals +10% damage (max 3) - Café, 5/5.';
    expect(normaliseText(text)).toBe(text);
  });

  it('turns blank text into an empty string', () => {
    expect(normaliseText('')).toBe('');
    expect(normaliseText('  \n ')).toBe('');
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (input) => {
        const once = normaliseText(input);
        expect(normaliseText(once)).toBe(once);
      }),
    );
  });
});
