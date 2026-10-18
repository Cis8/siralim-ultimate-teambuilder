import { describe, expect, it } from 'vitest';
import { applyEdit } from './text-edit';

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
