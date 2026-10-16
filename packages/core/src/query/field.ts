import type { IndexedTrait } from './indexed-trait';

/** Whether a trait is what one term of a query asks for. */
export type TraitMatcher = (trait: IndexedTrait) => boolean;

/**
 * What `field:value` means. The registry asks for a matcher once per term, so a field reads its value (parses `yes` or
 * `no`, say) once, not once per trait.
 */
export interface FieldDefinition {
  /** Lower case letters: how the query writes it, and what a diagnostic calls it. */
  readonly name: string;
  /** Other spellings, under the same rules as the name. */
  readonly aliases: readonly string[];
  /** `value` is lower case, trimmed, quotes stripped, and not empty. */
  readonly matcher: (value: string) => TraitMatcher;
}
