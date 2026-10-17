import { describe, expect, it } from 'vitest';
import type { KeywordKind } from './trait';
import { canBeDependency, hasActor, hasRole } from './keyword-kind';

const KINDS: readonly [kind: KeywordKind, role: boolean, actor: boolean, dependency: boolean][] = [
  ['debuff', true, false, true],
  ['buff', true, false, true],
  ['effect', true, false, true],
  ['event', true, true, false],
  ['mechanic', false, false, false],
  ['flag', false, false, false],
];

describe('what a kind of keyword can say about a trait', () => {
  it.each(KINDS)('%s: has a role %s', (kind, role) => {
    expect(hasRole(kind)).toBe(role);
  });

  it.each(KINDS)('%s: has an actor %s', (kind, _role, actor) => {
    expect(hasActor(kind)).toBe(actor);
  });

  // GAME_RULES R12: attacking, casting, turns, deaths: nobody has to supply them.
  it.each(KINDS)('%s: can be a dependency of the party %s', (kind, _role, _actor, dependency) => {
    expect(canBeDependency(kind)).toBe(dependency);
  });
});
