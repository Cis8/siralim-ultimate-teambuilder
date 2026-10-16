import type { KeywordKey, Trait } from '../model/trait';

/** The columns of a trait that fields read. */
export type ColumnName = 'class' | 'family' | 'creature' | 'name' | 'description' | 'material';

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
}

export function indexTrait(trait: Trait): IndexedTrait {
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
    applies: keysWhere(trait, (hit) => hit.role === 'applies'),
    uses: keysWhere(trait, (hit) => hit.role === 'uses'),
    keywords: keysWhere(trait, () => true),
  };
}

const fold = (text: string | null): string => text?.toLowerCase() ?? '';

function keysWhere(trait: Trait, wanted: (hit: Trait['keywords'][number]) => boolean): KeywordKey[] {
  return [...new Set(trait.keywords.filter(wanted).map((hit) => hit.key))];
}
