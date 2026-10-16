import type { KeywordKey, KeywordKind } from '../model/trait';

/** Where in a battle a trigger fires, in the order a battle goes. Traits with no trigger are "always on". */
export const TRIGGER_PHASES = [
  'startOfBattle',
  'startOfTurn',
  'attacking',
  'beingAttacked',
  'spellcasting',
  'killsAndDeaths',
] as const;
export type TriggerPhase = (typeof TRIGGER_PHASES)[number];

interface EntryBase<K extends KeywordKind> {
  readonly kind: K;
  /** What queries call it: `vulnerable`, `start of battle`. Lower case. */
  readonly key: KeywordKey;
  /** What the app shows. */
  readonly label: string;
  /** Phrases that name it in trait text, matched case-insensitively and as whole words. */
  readonly patterns: readonly string[];
}

interface CanonicalEntryBase<K extends 'buff' | 'debuff'> extends EntryBase<K> {
  /**
   * The name in the canonical lists (wiki, Codex Reference) when the compendium spells it differently; the
   * compendium wins (GAME_RULES R8). Absent when the two agree.
   */
  readonly canonicalName?: string;
}

export interface DebuffEntry extends CanonicalEntryBase<'debuff'> {
  /** `false` for the few debuffs that "random debuff" effects never apply (GAME_RULES R8). */
  readonly canBeRandomlyApplied: boolean;
}

export type BuffEntry = CanonicalEntryBase<'buff'>;
export type MechanicEntry = EntryBase<'mechanic'>;

/** What traits give and build on, beyond the canonical buffs and debuffs (GAME_RULES R11). Has a role like a buff. */
export interface EffectEntry extends EntryBase<'effect'> {
  /**
   * Patterns in the active voice ("Seals"): a trait written that way is the one doing it, so its role is `applies`.
   * Each must be one of `patterns`.
   */
  readonly activePatterns?: readonly string[];
}
export type FlagEntry = EntryBase<'flag'>;

export interface TriggerEntry extends EntryBase<'trigger'> {
  readonly phase: TriggerPhase;
}

export type TaxonomyEntry = DebuffEntry | BuffEntry | EffectEntry | MechanicEntry | TriggerEntry | FlagEntry;
