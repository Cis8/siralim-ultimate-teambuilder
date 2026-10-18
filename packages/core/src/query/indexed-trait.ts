import type { KeywordHit, KeywordKey, KeywordReference, Trait } from '../model/trait';

/** The columns of a trait that fields read. */
export type ColumnName = 'class' | 'family' | 'creature' | 'name' | 'description' | 'material';

/** The lists of keywords a trait is indexed by: the ones it applies, the ones it relies on, and all of them. */
export type KeywordList = 'applies' | 'uses' | 'keywords';

/** An event with the actor the text names (GAME_RULES R12). */
export type ActedKeyword = Required<KeywordReference>;

/**
 * A trait with what the query fields look at worked out once, when the dataset is loaded, so that evaluating a query
 * is comparing strings and walking short lists, never parsing or lower-casing.
 */
export interface IndexedTrait {
  readonly trait: Trait;
  /** Lower case. Empty where the trait has none: a mastery has no creature, and a trait may have no material. */
  readonly columns: Readonly<Record<ColumnName, string>>;
  /** Keys of the buffs, debuffs and effects the trait gives. Each key once, in order of appearance. */
  readonly applies: readonly KeywordKey[];
  /** Keys of the buffs, debuffs and effects the trait relies on. A mention that only guards against one is in neither. */
  readonly uses: readonly KeywordKey[];
  /** Keys of every keyword the trait mentions, of any kind and in any role. */
  readonly keywords: readonly KeywordKey[];
  /**
   * The same three lists for the mentions that name an actor, which are events, each key and actor once. The lists above
   * hold the key whoever acts, so a field asks them for an event by anyone and these for an event by one actor.
   */
  readonly acted: Readonly<Record<KeywordList, readonly ActedKeyword[]>>;
}

export function indexTrait(trait: Trait): IndexedTrait {
  const applies = (hit: KeywordHit) => hit.role === 'applies';
  const uses = (hit: KeywordHit) => hit.role === 'uses';
  const any = () => true;
  return {
    trait,
    columns: {
      class: fold(trait.class),
      family: fold(trait.family),
      creature: fold(trait.creature),
      name: fold(trait.name),
      description: fold(trait.description),
      material: fold(trait.material),
    },
    applies: keysWhere(trait, applies),
    uses: keysWhere(trait, uses),
    keywords: keysWhere(trait, any),
    acted: {
      applies: actedKeywordsWhere(trait, applies),
      uses: actedKeywordsWhere(trait, uses),
      keywords: actedKeywordsWhere(trait, any),
    },
  };
}

const fold = (text: string | null): string => text?.toLowerCase() ?? '';

function keysWhere(trait: Trait, wanted: (hit: KeywordHit) => boolean): KeywordKey[] {
  return [...new Set(trait.keywords.filter(wanted).map((hit) => hit.key))];
}

function actedKeywordsWhere(trait: Trait, wanted: (hit: KeywordHit) => boolean): ActedKeyword[] {
  const byId = new Map<string, ActedKeyword>();
  for (const { key, actor } of trait.keywords.filter(wanted)) {
    if (actor !== undefined) byId.set(`${actor}/${key}`, { key, actor });
  }
  return [...byId.values()];
}
