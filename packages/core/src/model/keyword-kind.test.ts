import { describe, expect, it } from 'vitest';
import type { KeywordKind } from './trait';
import { hasRole } from './keyword-kind';

describe('hasRole', () => {
  it.each<[KeywordKind, boolean]>([
    ['debuff', true],
    ['buff', true],
    ['effect', true],
    ['mechanic', false],
    ['trigger', false],
    ['flag', false],
  ])('is %s → %s', (kind, expected) => {
    expect(hasRole(kind)).toBe(expected);
  });
});
