import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyEdit, caretAfterEdit, type TextEdit } from './text-edit';

describe('applyEdit', () => {
  it('replaces the span and leaves every other character as it was', () => {
    expect(applyEdit('weak OR snared', { span: [5, 7], text: 'AND' })).toBe('weak AND snared');
    expect(applyEdit('  a   b  ', { span: [2, 3], text: 'x' })).toBe('  x   b  ');
  });

  it('removes a span with an empty text', () => {
    expect(applyEdit('a ) b', { span: [2, 4], text: '' })).toBe('a b');
  });

  it('inserts at an empty span, at the start, in the middle and at the end', () => {
    expect(applyEdit('weak', { span: [0, 0], text: '-' })).toBe('-weak');
    expect(applyEdit('weak', { span: [2, 2], text: '|' })).toBe('we|ak');
    expect(applyEdit('(weak', { span: [5, 5], text: ')' })).toBe('(weak)');
  });

  it('works on an empty text', () => {
    expect(applyEdit('', { span: [0, 0], text: 'weak' })).toBe('weak');
  });

  it('counts UTF-16 units, as the spans of the lexer do', () => {
    expect(applyEdit('é"😀 x', { span: [1, 4], text: '' })).toBe('é x');
  });
});

describe('caretAfterEdit', () => {
  // `clas:life (weak`, with the field name at [0, 4) mended to `class`.
  const rename: TextEdit = { span: [0, 4], text: 'class' };

  it('leaves a caret before the edit where it was', () => {
    expect(caretAfterEdit(0, { span: [5, 9], text: 'x' })).toBe(0);
    expect(caretAfterEdit(4, { span: [5, 9], text: 'x' })).toBe(4);
  });

  it('moves a caret after the edit by what the edit added or took away, so it stays in front of the same text', () => {
    expect(caretAfterEdit(15, rename)).toBe(16);
    expect(caretAfterEdit(10, { span: [5, 7], text: '' })).toBe(8);
  });

  it('puts a caret inside the replaced text, or at its end, after the text written', () => {
    expect(caretAfterEdit(2, rename)).toBe(5);
    expect(caretAfterEdit(4, rename)).toBe(5);
    expect(caretAfterEdit(3, { span: [2, 4], text: '' })).toBe(2);
  });

  it('keeps a caret at the start of the replaced text in front of what is written', () => {
    expect(caretAfterEdit(0, rename)).toBe(0);
  });

  it('puts a caret at an insertion after the text inserted, as when the person typed it', () => {
    expect(caretAfterEdit(5, { span: [5, 5], text: ')' })).toBe(6);
    expect(caretAfterEdit(3, { span: [5, 5], text: ')' })).toBe(3);
    expect(caretAfterEdit(7, { span: [5, 5], text: ')' })).toBe(8);
  });

  it('keeps the characters on either side of the caret that the edit did not touch', () => {
    const edit = fc.record({
      source: fc.string({ maxLength: 20 }),
      start: fc.nat(20),
      length: fc.nat(8),
      caret: fc.nat(20),
      text: fc.string({ maxLength: 6 }),
    });
    fc.assert(
      fc.property(edit, ({ source, start, length, caret, text }) => {
        const from = Math.min(start, source.length);
        const to = Math.min(from + length, source.length);
        const at = Math.min(caret, source.length);
        const after = applyEdit(source, { span: [from, to], text });
        const moved = caretAfterEdit(at, { span: [from, to], text });

        expect(moved).toBeGreaterThanOrEqual(0);
        expect(moved).toBeLessThanOrEqual(after.length);
        if (at < from) expect(after.slice(0, moved)).toBe(source.slice(0, at));
        if (at > to) expect(after.slice(moved)).toBe(source.slice(at));
      }),
    );
  });
});
