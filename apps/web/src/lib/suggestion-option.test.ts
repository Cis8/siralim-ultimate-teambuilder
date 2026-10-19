import type { CountedSuggestion } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { suggestionOption } from './suggestion-option';

const suggestion = (overrides: Partial<CountedSuggestion> = {}): CountedSuggestion => ({
  kind: 'debuff',
  insert: 'applies:vulnerable',
  detail: 'applies “vulnerable”',
  complete: true,
  replace: [0, 7],
  count: 42,
  ...overrides,
});

describe('the row of the list that a suggestion is', () => {
  it('has the kind in words, what is written, what it means and how many traits it finds', () => {
    expect(suggestionOption(suggestion())).toEqual({
      badge: 'Debuff',
      tone: 'debuff',
      label: 'applies:vulnerable',
      detail: 'applies “vulnerable”',
      trailing: '42',
      trailingUnit: 'traits',
      continues: false,
    });
  });

  it('writes the number as the rest of the page does, and says "trait" for one', () => {
    expect(suggestionOption(suggestion({ count: 1_780 }))).toMatchObject({ trailing: '1,780', trailingUnit: 'traits' });
    expect(suggestionOption(suggestion({ count: 1 }))).toMatchObject({ trailing: '1', trailingUnit: 'trait' });
  });

  it('says "0 traits" for a term that finds none: that is an answer', () => {
    expect(suggestionOption(suggestion({ count: 0 }))).toMatchObject({ trailing: '0', trailingUnit: 'traits' });
  });

  it('has no number when the suggestion was not counted (an operator, a bare field)', () => {
    const uncounted: CountedSuggestion = {
      kind: 'operator',
      insert: 'OR',
      detail: 'either side',
      complete: false,
      replace: [0, 0],
    };

    const option = suggestionOption(uncounted);

    expect(option).toMatchObject({ badge: 'Operator', label: 'OR', continues: true });
    expect(option).not.toHaveProperty('trailing');
    expect(option).not.toHaveProperty('trailingUnit');
  });

  it('keeps the list open for what comes next when the suggestion is not a finished term', () => {
    expect(suggestionOption(suggestion({ complete: false })).continues).toBe(true);
    expect(suggestionOption(suggestion({ complete: true })).continues).toBe(false);
  });

  it('colours the badge of a buff, a debuff, a mechanic and an event, and leaves the others neutral', () => {
    const toneOf = (kind: CountedSuggestion['kind']) => suggestionOption(suggestion({ kind })).tone;

    expect(['buff', 'debuff', 'mechanic', 'event'].map((kind) => toneOf(kind as CountedSuggestion['kind']))).toEqual([
      'buff',
      'debuff',
      'mechanic',
      'event',
    ]);
    for (const kind of [
      'effect',
      'flag',
      'class',
      'family',
      'creature',
      'trait',
      'value',
      'field',
      'operator',
      'actor',
      'text',
    ] as const) {
      expect(toneOf(kind)).toBe('neutral');
    }
  });

  it('names every kind in a word of its own, so that the colour never says it alone', () => {
    const kinds = [
      'debuff',
      'buff',
      'effect',
      'event',
      'mechanic',
      'flag',
      'class',
      'family',
      'creature',
      'trait',
      'value',
      'field',
      'operator',
      'actor',
      'text',
    ] as const;

    const badges = kinds.map((kind) => suggestionOption(suggestion({ kind })).badge);

    expect(new Set(badges).size).toBe(kinds.length);
    expect(badges.every((badge) => badge !== '')).toBe(true);
  });
});
