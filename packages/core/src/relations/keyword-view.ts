import type { KeywordKey, Trait } from '../model/trait';
import type { KeyRelations } from './key-relations';
import { eligibleTraits, type RelationOptions } from './relation-options';

/** How many traits stand in each list of a key: what the summary and the chip of the key say. */
export interface KeywordStats {
  readonly appliers: number;
  readonly conditional: number;
  readonly random: number;
  readonly users: number;
}

/**
 * How well a buff, debuff or effect is supported, from the worst case to the best. Applying it by name is what supports it:
 * the weaker sources only change the verdict while nothing applies it.
 */
export type KeywordVerdict =
  /** Nothing gives it, whatever relies on it. */
  | 'no-source'
  /** Nothing applies it by name, and a trait afflicts a random debuff on enemies (GAME_RULES R5). */
  | 'only-random'
  /** Nothing applies it by name or at random, and a trait gives it once the other debuff of its pair is there (R10). */
  | 'only-conditional'
  /** Some trait applies it and nothing relies on it. */
  | 'no-payoff'
  /** Many traits rely on it and few apply it: appliers × 2 < users. */
  | 'scarce'
  | 'supported';

/** Another key that the appliers of a key apply as well, and how many of them do. */
export interface CoApplied {
  readonly key: KeywordKey;
  readonly count: number;
}

/** A buff, debuff or effect seen from the keyword: who gives it, who relies on it, and whether that is enough. */
export interface KeywordView extends KeyRelations {
  readonly stats: KeywordStats;
  readonly verdict: KeywordVerdict;
  /** The keys the appliers also apply (never an event or a mechanic), the most shared first, then in the order of the taxonomy. */
  readonly coApplied: readonly CoApplied[];
}

/**
 * The verdict of a key with the given counts. The sources are asked first, in the order of GAME_RULES (*Dependency statuses*):
 * something that applies the key by name settles that question; failing that, a random source makes it `only-random`
 * (a conditional one beside it does not change that) and a conditional one alone makes it `only-conditional`. Then the payoff:
 * nobody relying on the key, or fewer than half as many appliers as users. A random or conditional source never counts as an
 * applier there.
 */
export function verdictOf({ appliers, conditional, random, users }: KeywordStats): KeywordVerdict {
  if (appliers === 0) {
    if (random > 0) return 'only-random';
    return conditional > 0 ? 'only-conditional' : 'no-source';
  }
  if (users === 0) return 'no-payoff';
  return appliers * 2 < users ? 'scarce' : 'supported';
}

/** The lists of a key without the traits the options leave out. */
function eligibleLists(relations: KeyRelations, options: RelationOptions): Omit<KeyRelations, 'key'> {
  const eligible = eligibleTraits(options);
  return {
    appliers: relations.appliers.filter(eligible),
    conditional: relations.conditional.filter(eligible),
    random: relations.random.filter(eligible),
    users: relations.users.filter(eligible),
  };
}

function statsOf(lists: Omit<KeyRelations, 'key'>): KeywordStats {
  return {
    appliers: lists.appliers.length,
    conditional: lists.conditional.length,
    random: lists.random.length,
    users: lists.users.length,
  };
}

/** The counts of a key, as `keywordViewOf` has them. */
export function keywordStatsOf(relations: KeyRelations, options: RelationOptions): KeywordStats {
  return statsOf(eligibleLists(relations, options));
}

/** The view of a key. Pure: the index hands it the keys that can be a dependency, in the order of the taxonomy. */
export function keywordViewOf(
  relations: KeyRelations,
  keys: readonly KeywordKey[],
  options: RelationOptions,
): KeywordView {
  const lists = eligibleLists(relations, options);
  const stats = statsOf(lists);
  return {
    key: relations.key,
    ...lists,
    stats,
    verdict: verdictOf(stats),
    coApplied: coAppliedWith(relations.key, lists.appliers, keys),
  };
}

function coAppliedWith(key: KeywordKey, appliers: readonly Trait[], keys: readonly KeywordKey[]): CoApplied[] {
  const counts = new Map<KeywordKey, number>(keys.filter((other) => other !== key).map((other) => [other, 0]));
  for (const trait of appliers) {
    const given = new Set(trait.keywords.filter((hit) => hit.role === 'applies').map((hit) => hit.key));
    for (const other of given) {
      const count = counts.get(other);
      if (count !== undefined) counts.set(other, count + 1);
    }
  }
  // The map is in the order of the taxonomy and a sort keeps the order of equals: that is the tie-break.
  return [...counts]
    .filter(([, count]) => count > 0)
    .map(([other, count]) => ({ key: other, count }))
    .toSorted((a, b) => b.count - a.count);
}
