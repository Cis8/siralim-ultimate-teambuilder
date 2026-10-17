/** Stable, URL-safe identifier of a trait (SPEC §5), e.g. `abomination--sin-and-sentence`. */
export type TraitId = string;

/** Open set: the five creature classes plus whatever the compendium adds (GAME_RULES R7). */
export type ClassName = string;

/** Key of a taxonomy entry: `vulnerable`, `start of battle`, `barrier`, … */
export type KeywordKey = string;

/** GAME_RULES R7. */
export type TraitKind = 'creature' | 'avatar' | 'mastery' | 'backer' | 'other';

/** A trait as read from the sheet after normalisation, before identity and enrichment. */
export interface TraitRow {
  readonly class: ClassName;
  readonly family: string;
  /** The raw Creature column: also `Mastery Trait` and `Backer Trait`, which `kind` is derived from. */
  readonly creature: string;
  readonly name: string;
  readonly description: string;
  /** `null` when the sheet says `No Material Exists`: the trait can never sit in the Artifact slot. */
  readonly material: string | null;
}

export interface IdentifiedTraitRow extends TraitRow {
  readonly id: TraitId;
}

/** GAME_RULES R5. */
export interface RandomDebuffSource {
  readonly target: 'enemy' | 'self_or_allies' | 'both';
  readonly activation: 'unconditional' | 'conditional';
  /** What a conditional source depends on. */
  readonly note?: string;
}

/** GAME_RULES R3. `families` holds plural forms already resolved to family names. */
export type PartyRequirement =
  | { readonly type: 'allFamily'; readonly families: readonly string[] }
  | {
      readonly type: 'distinctFamilyCount';
      readonly families: readonly string[];
      readonly count: number;
    }
  | { readonly type: 'perFamilyCount'; readonly families: readonly string[] }
  | { readonly type: 'classDiversity' }
  | { readonly type: 'familyScoped'; readonly families: readonly string[] }
  | { readonly type: 'none' };

/**
 * What a keyword is. Buffs, debuffs, effects and events have a role (see `hasRole`); mechanics and flags do not. An
 * *effect* is something traits give and others build on that the canonical buff and debuff lists do not have: stacking
 * minions (Dire Wolves, Zombies), Mega Magic, Sealed Spell Gems (GAME_RULES R11). An *event* is something that happens in
 * battle: a turn begins, a creature attacks, casts, dies (GAME_RULES R12).
 */
export type KeywordKind = 'debuff' | 'buff' | 'effect' | 'event' | 'mechanic' | 'flag';

/**
 * What a trait does with a keyword that has a role. A buff, debuff or effect: gives it (`applies`), relies on it being
 * there (`uses`), or only guards against it, as in "immune to Silenced" (`resists`), which depends on nobody applying it
 * (GAME_RULES R9). An event: makes it happen (`applies`: "attacks 1 additional time"), pays off when it happens (`uses`:
 * "after this creature attacks") or prevents it (`resists`: "cannot be resurrected"), GAME_RULES R12.
 */
export type KeywordRole = 'applies' | 'uses' | 'resists';

/**
 * Who an event happens to or is done by (GAME_RULES R12): this creature (`self`), your creatures or an ally (`ally`), an
 * enemy (`enemy`) or any creature (`any`). It is what the text says, and a text may say nothing ("at the start of battle").
 */
export type KeywordActor = 'self' | 'ally' | 'enemy' | 'any';

export interface KeywordHit {
  readonly key: KeywordKey;
  readonly kind: KeywordKind;
  /** Only for keywords that have a role (`hasRole`): buffs, debuffs, effects and events. */
  readonly role?: KeywordRole;
  /** Only for events (`hasActor`), and only where the text says who. */
  readonly actor?: KeywordActor;
  /** Half-open character range `[start, end)` in the trait description. */
  readonly span: readonly [start: number, end: number];
}

export interface Trait {
  readonly id: TraitId;
  readonly name: string;
  /** `null` for mastery and backer traits. */
  readonly creature: string | null;
  readonly family: string;
  readonly class: ClassName;
  readonly kind: TraitKind;
  readonly description: string;
  readonly material: string | null;
  /** `false` when the text says "This trait does not stack" (GAME_RULES R4). */
  readonly stacks: boolean;
  readonly randomDebuff: RandomDebuffSource | null;
  /** Mastery only: the Family column, never parsed from the text (GAME_RULES R3). */
  readonly masteryFamily: string | null;
  /** Mastery only: parsed from the text (GAME_RULES R3). */
  readonly partyRequirement: PartyRequirement | null;
  /** Ordered by position in the description. */
  readonly keywords: readonly KeywordHit[];
  /**
   * Buffs and debuffs the trait applies only through a condition it does not state as applying them: "afflicts them
   * with whichever of these debuffs the target doesn't already have" makes it a conditional source of each one named
   * (GAME_RULES R10). Keys in order of appearance, without repeats.
   */
  readonly conditionalSources: readonly KeywordKey[];
}
