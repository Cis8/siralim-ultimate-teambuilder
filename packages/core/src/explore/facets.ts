import { CREATURE_CLASSES } from '../enrichment/trait-kind';
import { KEYWORD_ACTORS, type ClassName, type KeywordActor, type KeywordKey, type KeywordKind } from '../model/trait';
import type { IndexedTrait } from '../query/indexed-trait';
import type { TraitIndex } from '../query/trait-index';
import type { EventGroup } from '../taxonomy/entry';
import type { Taxonomy } from '../taxonomy/registry';
import { compareTextIgnoringCase } from '../text/compare-text';
import { actorSet, actorSetKey, type ActorSet } from './actor-set';

/** The kinds of keyword that have a facet, in the order the panel shows them. The flag is a checkbox of its own. */
export const FACET_KEYWORD_KINDS = [
  'debuff',
  'buff',
  'effect',
  'event',
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

/** How many of the traits shown mention a keyword. A mechanic has no role: only `mentions` counts for it. */
export interface KeywordFacet {
  readonly key: KeywordKey;
  readonly label: string;
  readonly kind: FacetKeywordKind;
  /** Events only: the heading the panel lists it under. */
  readonly group?: EventGroup;
  /** Traits that give it. */
  readonly applies: number;
  /** Traits that rely on it. */
  readonly uses: number;
  /** Traits that mention it in any role, a mention that only guards against it included (what `kw:` finds). */
  readonly mentions: number;
  /**
   * Events only: `applies` and `uses` again, for the traits whose text names some actors, for every combination of them
   * (`self`, `self+enemy`, …: the key is `actorSetKey`; `facetCount` reads it). A trait counts once when it names at least
   * one of the actors, which is what the filters of those actors on a side find together (`applies:attack/self` or
   * `applies:attack/enemy`). A mention that names none is in none: the counts can be short of the count by anyone.
   */
  readonly byActors?: Readonly<Record<string, SideCounts>>;
}

/** The two sides of a keyword that a filter has (`applies:` and `uses:`). */
export type KeywordSide = 'applies' | 'uses';
export type SideCounts = Readonly<Record<KeywordSide, number>>;

/**
 * The number the panel shows on a side of a keyword: the traits that have it, whoever acts, or the traits whose text names at
 * least one of `actors`. A keyword with no actors (a buff) has none to name, so 0.
 */
export function facetCount(
  facet: Pick<KeywordFacet, KeywordSide | 'byActors'>,
  side: KeywordSide,
  actors: ActorSet = [],
): number {
  return actors.length === 0 ? facet[side] : (facet.byActors?.[actorSetKey(actors)]?.[side] ?? 0);
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
  readonly keywords: readonly Pick<KeywordFacet, 'key' | 'label' | 'kind' | 'group'>[];
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
      taxonomy.ofKind(kind).map((entry) => ({
        key: entry.key,
        label: entry.label,
        kind,
        ...(entry.kind === 'event' ? { group: entry.group } : {}),
      })),
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
  const actedApplies = actorHistograms(found, 'applies');
  const actedUses = actorHistograms(found, 'uses');
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
      ...(keyword.kind === 'event'
        ? {
            byActors: Object.fromEntries(
              ACTOR_SETS.map(({ key, bits }) => [
                key,
                {
                  applies: traitsNaming(actedApplies.get(keyword.key), bits),
                  uses: traitsNaming(actedUses.get(keyword.key), bits),
                },
              ]),
            ),
          }
        : {}),
    })),
  };
}

/** An actor as a bit, in the order of the rules: a set of actors is the bits of its members. */
const bitOf = (actor: KeywordActor): number => 1 << KEYWORD_ACTORS.indexOf(actor);

/**
 * Every combination of actors but none, which is the count by anyone, with its key and its bits, worked out once. A new actor
 * doubles them.
 */
const ACTOR_SETS = Array.from({ length: 2 ** KEYWORD_ACTORS.length - 1 }, (_, at) => {
  const bits = at + 1;
  return { key: actorSetKey(actorSet(KEYWORD_ACTORS.filter((actor) => (bits & bitOf(actor)) !== 0))), bits };
});

/**
 * For each event, how many of the traits name exactly each combination of actors on a side: the position in the list is the
 * bits of the combination (`bitOf`). A trait names an event as often as its text does, and counts once, for the actors of
 * all its mentions together.
 */
function actorHistograms(traits: readonly IndexedTrait[], side: KeywordSide): Map<KeywordKey, number[]> {
  const histograms = new Map<KeywordKey, number[]>();
  for (const { acted } of traits) {
    const named = new Map<KeywordKey, number>();
    for (const { key, actor } of acted[side]) named.set(key, (named.get(key) ?? 0) | bitOf(actor));
    for (const [key, bits] of named) {
      const histogram = histograms.get(key) ?? Array.from({ length: 2 ** KEYWORD_ACTORS.length }, () => 0);
      histogram[bits] = (histogram[bits] ?? 0) + 1;
      histograms.set(key, histogram);
    }
  }
  return histograms;
}

/** The traits of a histogram that name at least one of the actors, given as bits. */
function traitsNaming(histogram: readonly number[] | undefined, wanted: number): number {
  let sum = 0;
  histogram?.forEach((traits, bits) => {
    if ((bits & wanted) !== 0) sum += traits;
  });
  return sum;
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
