import { CREATURE_CLASSES } from '../enrichment/trait-kind';
import type { ClassName, KeywordKey, KeywordKind } from '../model/trait';
import type { IndexedTrait } from '../query/indexed-trait';
import type { TraitIndex } from '../query/trait-index';
import type { Taxonomy } from '../taxonomy/registry';
import { compareTextIgnoringCase } from '../text/compare-text';

/** The kinds of keyword that have a facet, in the order the panel shows them. The flag is a checkbox of its own. */
export const FACET_KEYWORD_KINDS = [
  'debuff',
  'buff',
  'effect',
  'trigger',
  'mechanic',
] as const satisfies readonly KeywordKind[];
export type FacetKeywordKind = (typeof FACET_KEYWORD_KINDS)[number];

export interface ClassFacet {
  /** As the dataset spells it. */
  readonly name: ClassName;
  readonly count: number;
  /** One of the five classes of a creature (GAME_RULES R7), which the panel lists apart from the others. */
  readonly standard: boolean;
}

/** How many of the traits shown mention a keyword. A trigger or a mechanic has no role: only `mentions` counts for it. */
export interface KeywordFacet {
  readonly key: KeywordKey;
  readonly label: string;
  readonly kind: FacetKeywordKind;
  /** Traits that give it. */
  readonly applies: number;
  /** Traits that rely on it. */
  readonly uses: number;
  /** Traits that mention it in any role, a mention that only guards against it included (what `kw:` finds). */
  readonly mentions: number;
}

export interface Facets {
  /** In the order of `FacetVocabulary.classes`. */
  readonly classes: readonly ClassFacet[];
  /** By kind, then in the order of the taxonomy. */
  readonly keywords: readonly KeywordFacet[];
}

/** What the facets list, worked out once, when the dataset is loaded. */
export interface FacetVocabulary {
  /**
   * Each class of the dataset once, as first spelled. The five classes of a creature come first, from A to Z; the others
   * follow, the one with most traits in the dataset first, and from A to Z among those with as many. The order is that of
   * the whole dataset, not of the traits shown, so that the list does not move as the filters change.
   */
  readonly classes: readonly Pick<ClassFacet, 'name' | 'standard'>[];
  readonly keywords: readonly Pick<KeywordFacet, 'key' | 'label' | 'kind'>[];
}

export function facetVocabulary(index: TraitIndex, taxonomy: Taxonomy): FacetVocabulary {
  const spellings = new Map<string, ClassName>();
  const traitCounts = tally(index.entries, ({ columns }) => [columns.class]);
  for (const { trait } of index.entries) {
    const name = trait.class.toLowerCase();
    if (!spellings.has(name)) spellings.set(name, trait.class);
  }
  const classes = [...spellings].map(([lowerCaseName, name]) => ({
    name,
    standard: CREATURE_CLASSES.has(name),
    traits: traitCounts.get(lowerCaseName) ?? 0,
  }));
  return {
    classes: classes.toSorted(compareClasses).map(({ name, standard }) => ({ name, standard })),
    keywords: FACET_KEYWORD_KINDS.flatMap((kind) =>
      taxonomy.ofKind(kind).map(({ key, label }) => ({ key, label, kind })),
    ),
  };
}

interface ClassEntry extends Pick<ClassFacet, 'name' | 'standard'> {
  /** In the whole dataset. */
  readonly traits: number;
}

function compareClasses(a: ClassEntry, b: ClassEntry): number {
  if (a.standard !== b.standard) return a.standard ? -1 : 1;
  // The five of a creature stand from A to Z; among the others the larger class comes first.
  return (a.standard ? 0 : b.traits - a.traits) || compareTextIgnoringCase(a.name, b.name);
}

/**
 * The counts of the facets (SPEC §8.1). Classes are counted among `withoutClassFilter`, the traits that everything but
 * the class filter leaves, so that a class chosen does not hide the others; keywords among `found`, the traits shown.
 */
export function countFacets(
  vocabulary: FacetVocabulary,
  withoutClassFilter: readonly IndexedTrait[],
  found: readonly IndexedTrait[],
): Facets {
  const perClass = tally(withoutClassFilter, ({ columns }) => [columns.class]);
  const applies = tally(found, (trait) => trait.applies);
  const uses = tally(found, (trait) => trait.uses);
  const mentions = tally(found, (trait) => trait.keywords);
  return {
    classes: vocabulary.classes.map(({ name, standard }) => ({
      name,
      count: perClass.get(name.toLowerCase()) ?? 0,
      standard,
    })),
    keywords: vocabulary.keywords.map((keyword) => ({
      ...keyword,
      applies: applies.get(keyword.key) ?? 0,
      uses: uses.get(keyword.key) ?? 0,
      mentions: mentions.get(keyword.key) ?? 0,
    })),
  };
}

/** How many traits list each name. A trait lists a name once. */
function tally(
  traits: readonly IndexedTrait[],
  namesOf: (trait: IndexedTrait) => readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const trait of traits) {
    for (const name of namesOf(trait)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}
