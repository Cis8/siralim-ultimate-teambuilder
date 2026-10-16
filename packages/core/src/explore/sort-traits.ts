import type { Trait } from '../model/trait';
import { compareTextIgnoringCase } from '../text/compare-text';
import type { SortKey } from './explore-state';

type TraitComparator = (a: Trait, b: Trait) => number;

/**
 * One strategy per sort key (the compiler insists on each). No comparator is the order the traits come in, which for
 * `book` is that of the dataset: by family, then trait name, not the order of the rows of the sheet (SPEC §6).
 */
const comparators: Readonly<Record<SortKey, TraitComparator | undefined>> = {
  book: undefined,
  class: (a, b) => compareTextIgnoringCase(a.class, b.class) || compareTextIgnoringCase(a.family, b.family),
  az: (a, b) => compareTextIgnoringCase(a.name, b.name),
};

/** The traits in the order of the sort. Traits that tie keep the order they came in. */
export function sortTraits(traits: readonly Trait[], key: SortKey): readonly Trait[] {
  const comparator = comparators[key];
  return comparator === undefined ? traits : traits.toSorted(comparator);
}
