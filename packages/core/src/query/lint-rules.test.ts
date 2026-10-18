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
    ]);
  });
});
