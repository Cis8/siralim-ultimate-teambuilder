import { describe, expect, it } from 'vitest';
import { caretToLint } from './lint-caret';

describe('caretToLint', () => {
  it('is the caret of a field the person is in', () => {
    expect(caretToLint({ selectionStart: 7, selectionEnd: 7 })).toBe(7);
    expect(caretToLint({ selectionStart: 0, selectionEnd: 0 })).toBe(0);
  });

  it('is no caret for a selection: the person is choosing text, not finishing a term', () => {
    expect(caretToLint({ selectionStart: 2, selectionEnd: 7 })).toBeUndefined();
  });

  it('is no caret for a field that has none', () => {
    expect(caretToLint({ selectionStart: null, selectionEnd: null })).toBeUndefined();
  });
});
