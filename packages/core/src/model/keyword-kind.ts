import type { KeywordKind } from './trait';

/** Whether a trait can give, rely on or guard against a keyword of this kind: buffs, debuffs and effects. */
export function hasRole(kind: KeywordKind): boolean {
  return kind === 'buff' || kind === 'debuff' || kind === 'effect';
}
