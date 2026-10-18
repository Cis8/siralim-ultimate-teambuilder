import { describe, expect, it } from 'vitest';
import { changeTo, listOf, quoted, writtenValue } from './finding-text';

describe('the words and edits of a finding', () => {
  it('quotes a text the way the messages do', () => {
    expect(quoted('lfe')).toBe('“lfe”');
  });

  it.each([
    [[], ''],
    [['yes'], 'yes'],
    [['yes', 'no'], 'yes or no'],
    [['self', 'ally', 'enemy', 'any'], 'self, ally, enemy or any'],
  ])('lists %j as %j', (words, text) => {
    expect(listOf(words)).toBe(text);
  });

  it('makes the button that puts a text in place of a span, saying what it puts there', () => {
    expect(changeTo([6, 9], '"Rodian Master"', 'Rodian Master')).toEqual({
      label: 'Change to “Rodian Master”',
      edit: { span: [6, 9], text: '"Rodian Master"' },
    });
  });

  it('writes a value as the lexer needs it after the field: in quotes only where it must be', () => {
    expect(writtenValue('class', 'Life')).toBe('Life');
    expect(writtenValue('creature', 'Clutcher Bruiser')).toBe('"Clutcher Bruiser"');
    expect(writtenValue('u', 'start of turn/self')).toBe('"start of turn/self"');
    expect(writtenValue('u', 'weak/self')).toBe('weak/self');
  });
});
