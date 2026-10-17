import type { KeywordKind } from './trait';

/** Whether a trait can give, rely on or guard against a keyword of this kind: buffs, debuffs, effects and events. */
export function hasRole(kind: KeywordKind): boolean {
  return kind === 'buff' || kind === 'debuff' || kind === 'effect' || kind === 'event';
}

/** Whether a mention says who does it (`KeywordActor`): only events happen to somebody (GAME_RULES R12). */
export function hasActor(kind: KeywordKind): boolean {
  return kind === 'event';
}

/**
 * Whether a trait that relies on a keyword of this kind needs the party to supply it (GAME_RULES R9, R12): a buff, a
 * debuff or an effect. An event never is: attacking, casting and provoking are the player's choices, and turns, damage
 * and deaths happen by themselves.
 */
export function canBeDependency(kind: KeywordKind): boolean {
  return kind === 'buff' || kind === 'debuff' || kind === 'effect';
}
