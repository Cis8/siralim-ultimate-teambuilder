import { describe, expect, it } from 'vitest';
import { lintRegistry } from './lint-rules';

describe('the lint rules of the app', () => {
  it('are these, in this order: the registry takes them, so their ids are valid and tell them apart', () => {
    expect(lintRegistry.rules.map(({ id }) => id)).toEqual([
      'unknown-field',
      'empty-value',
      'invalid-choice',
      'unknown-class',
      'unknown-family',
      'unknown-creature',
      'unknown-trait',
      'unknown-keyword',
      'keyword-without-role',
      'unknown-actor',
      'keyword-without-actor',
      'text-in-no-trait',
    ]);
  });

  it('wait for the term to be finished, but for the one that a field nobody knows needs no value to be wrong (D20)', () => {
    const speaking = lintRegistry.rules.filter(({ reportsWhileTyping }) => reportsWhileTyping === true);

    expect(speaking.map(({ id }) => id)).toEqual(['unknown-field']);
  });
});
