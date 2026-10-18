import { compareTextIgnoringCase } from '../text/compare-text';
import type { VocabularyColumn } from './field';
import type { TraitIndex } from './trait-index';

/**
 * What the dataset gives a person to type after `class:`, `family:`, `creature:` and `trait:`: for each column, its
 * distinct entries as the dataset first spells them, from A to Z whatever the letter case. An entry is listed once however
 * its letter case varies (a query compares them folded), and a trait with no value in a column (a mastery has no creature)
 * adds none. The keywords are not here: they come from the taxonomy, which does not depend on the dataset.
 */
export type QueryVocabulary = Readonly<Record<VocabularyColumn, readonly string[]>>;

/** Worked out once, when the dataset is loaded: lint and suggestions read the lists, not the traits. */
export function createQueryVocabulary(index: TraitIndex): QueryVocabulary {
  return {
    class: entriesOf(index, 'class'),
    family: entriesOf(index, 'family'),
    creature: entriesOf(index, 'creature'),
    name: entriesOf(index, 'name'),
  };
}

function entriesOf(index: TraitIndex, column: VocabularyColumn): readonly string[] {
  const spellings = new Map<string, string>();
  for (const { columns, trait } of index.entries) {
    const folded = columns[column];
    const spelling = trait[column];
    if (folded !== '' && spelling !== null && !spellings.has(folded)) spellings.set(folded, spelling);
  }
  return [...spellings.values()].toSorted(compareTextIgnoringCase);
}
