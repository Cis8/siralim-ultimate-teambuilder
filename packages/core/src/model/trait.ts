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

export interface KeywordHit {
  readonly key: KeywordKey;
  readonly kind: 'debuff' | 'buff' | 'mechanic' | 'trigger' | 'flag';
  /** Only for buffs and debuffs. */
  readonly role?: 'applies' | 'uses';
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
}
