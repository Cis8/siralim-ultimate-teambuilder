import type { KeywordActor, KeywordKey, KeywordKind } from '../model/trait';

/**
 * Where in a battle an event happens, in the order a battle goes. An event with no phase happens at any time (healing, a
 * buff, a debuff), and a trait with no event is "always on".
 */
export const TRIGGER_PHASES = [
  'startOfBattle',
  'startOfTurn',
  'attacking',
  'beingAttacked',
  'defending',
  'spellcasting',
  'killsAndDeaths',
  'endOfTurn',
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

/**
 * An old key that stands for an event, and for who does it: `after this creature attacks` is `attack` by `self`. Queries
 * and addresses written before events (ADR-0009) keep working. Without an actor the alias is the event of any creature.
 */
export interface EventAlias {
  readonly key: KeywordKey;
  readonly actor?: KeywordActor;
}

/**
 * Something that happens in battle (GAME_RULES R12, ADR-0009). A mention has a role, as a buff has, and an actor, which
 * the extractor reads from the text around it: the entry only says what the event is called in the texts.
 */
export interface EventEntry extends EntryBase<'event'> {
  /** Absent for the events that can happen at any time. */
  readonly phase?: TriggerPhase;
  /** The edge of a turn this event is, which is not a phrase but a grammar ("start of <whose> turn"): see `findTurns`. */
  readonly turnEdge?: 'start' | 'end';
  /**
   * A moment of the battle and not something a creature does: nobody makes the battle start, so a mention has no actor and
   * is never `applies` ("Your creatures start battles with Shelled" waits for the start like "At the start of battle").
   */
  readonly moment?: boolean;
  /**
   * Patterns that are also the name of a stat ("50% more attack"). Where the text uses one that way, it is no event.
   * Each must be one of `patterns`.
   */
  readonly statPatterns?: readonly string[];
  readonly aliases?: readonly EventAlias[];
}

export type TaxonomyEntry = DebuffEntry | BuffEntry | EffectEntry | MechanicEntry | EventEntry | FlagEntry;
