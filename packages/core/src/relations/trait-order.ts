import type { Trait } from '../model/trait';
import { compareText, compareTextIgnoringCase } from '../text/compare-text';

/**
 * The order of the traits in a list a reader looks through, when nothing ranks them apart: by name regardless of case, then
 * by the exact name, then by id, so that the order never depends on the order the traits were given in.
 */
export function compareTraitsByName(a: Trait, b: Trait): number {
  return compareTextIgnoringCase(a.name, b.name) || compareText(a.id, b.id);
}

/** A trait listed for what it has in common with the focus. */
export interface Overlap {
  readonly trait: Trait;
  readonly shared: readonly unknown[];
}

/** The order of a list of lookalikes: the most in common with the focus first, then by name. */
export function compareByOverlap(a: Overlap, b: Overlap): number {
  return b.shared.length - a.shared.length || compareTraitsByName(a.trait, b.trait);
}
