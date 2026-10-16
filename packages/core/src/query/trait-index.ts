import type { Trait } from '../model/trait';
import { indexTrait, type IndexedTrait } from './indexed-trait';

/**
 * The traits of the dataset, indexed once when it is loaded. Evaluating a query reads this and nothing else; a faster
 * structure (an inverted index, say) can replace the list without a change to `evaluate`.
 */
export interface TraitIndex {
  /** In the order the traits were given. */
  readonly entries: readonly IndexedTrait[];
}

export function createTraitIndex(traits: readonly Trait[]): TraitIndex {
  return { entries: traits.map((trait) => indexTrait(trait)) };
}
