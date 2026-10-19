import type { KeywordKey, Trait } from '../model/trait';

/**
 * Who gives a buff, debuff or effect and who relies on it. A trait is listed once in each list it belongs to, and under the
 * strongest way it gives the key: `appliers`, then `conditional`, then `random`, so no trait is in two of those three.
 */
export interface KeyRelations {
  readonly key: KeywordKey;
  /** Apply it by name (the role `applies`). */
  readonly appliers: readonly Trait[];
  /** Apply it only once the other debuff of a pair is there (`conditionalSources`, GAME_RULES R10). */
  readonly conditional: readonly Trait[];
  /**
   * Afflict a random debuff on enemies (GAME_RULES R5), for a debuff that can be applied at random (R8). A random source that
   * works only under a condition is here as well: `randomDebuff.activation` of the trait says so.
   */
  readonly random: readonly Trait[];
  /** Rely on it being there (the role `uses`). They may also be in a list of sources: a trait can give what it relies on. */
  readonly users: readonly Trait[];
}
