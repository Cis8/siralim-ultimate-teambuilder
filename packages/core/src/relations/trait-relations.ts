import type { KeywordKey, KeywordRole, Trait, TraitId } from '../model/trait';
import type { KeyRelations } from './key-relations';
import { eligibleTraits, type RelationOptions } from './relation-options';
import { compareTraitsByName } from './trait-order';

/**
 * How a trait gives a key, strongest first: it applies it by name, it applies it once the other debuff of a pair is there
 * (GAME_RULES R10), or it afflicts a random debuff on enemies (R5).
 */
export type SourceStrength = 'specific' | 'conditional' | 'random';

const STRENGTHS: readonly SourceStrength[] = ['specific', 'conditional', 'random'];

/** A trait that links to this many keys of the focus or more goes in the *several* lane (PLAN D17). */
const SEVERAL_LINKS = 2;

/** One key that ties a trait to the focus, and how strongly the trait gives it. */
export interface KeyLink {
  readonly key: KeywordKey;
  readonly strength: SourceStrength;
}

export interface RelatedTrait {
  readonly trait: Trait;
  /** One link for each key of the focus the trait is tied to it by, in the order the focus names them. */
  readonly links: readonly KeyLink[];
  /** The number of keys that tie the two traits together (SPEC §8.4). */
  readonly score: number;
  /** The strongest of its links: a trait that applies one key by name is a specific enabler, whatever else it does at random. */
  readonly strength: SourceStrength;
}

/** The traits tied to the focus through this key alone. */
export interface KeyLane {
  readonly key: KeywordKey;
  readonly entries: readonly RelatedTrait[];
}

/**
 * One side of the relations of a trait. A trait is listed once on its side (PLAN D17): in `several` when it ties to two keys
 * of the focus or more, else in the lane of its only key. Both are ranked by `strength`, then `score` (most links first), then
 * the name of the trait regardless of case, then its id.
 */
export interface RelationSide {
  readonly several: readonly RelatedTrait[];
  /** A lane for each key of the focus that has a trait of its own, in the order the focus names the keys. */
  readonly single: readonly KeyLane[];
  /** The keys of the focus no trait is tied through, in the same order: a key whose traits are all in `several` is not one. */
  readonly unmet: readonly KeywordKey[];
  /** The traits on the side. */
  readonly count: number;
}

export interface TraitRelations {
  /** Traits that give what the focus relies on. */
  readonly enabledBy: RelationSide;
  /** Traits that rely on what the focus applies by name. */
  readonly enables: RelationSide;
}

type Tiers = (relations: KeyRelations) => readonly (readonly [SourceStrength, readonly Trait[]])[];

const ENABLED_BY: Tiers = ({ appliers, conditional, random }) => [
  ['specific', appliers],
  ['conditional', conditional],
  ['random', random],
];

/** Only a trait that applies a key by name enables the traits that rely on it: the weaker sources have no side here. */
const ENABLES: Tiers = ({ users }) => [['specific', users]];

/**
 * What enables the focus and what it enables, from the lists of who gives and who relies on each key. Pure: the index
 * hands it its `get`. The focus is never in its own lists, though a trait can give what it relies on.
 */
export function relationsOfTrait(
  focus: Trait,
  lookup: (key: KeywordKey) => KeyRelations | undefined,
  options: RelationOptions,
): TraitRelations {
  const eligible = eligibleTraits(options);
  return {
    enabledBy: sideOf(focus, focusKeys(focus, 'uses', lookup), ENABLED_BY, eligible),
    enables: sideOf(focus, focusKeys(focus, 'applies', lookup), ENABLES, eligible),
  };
}

/** The relations of each key the focus mentions with the role, once each, in the order it names them: a key the index lacks is no key. */
function focusKeys(
  focus: Trait,
  role: KeywordRole,
  lookup: (key: KeywordKey) => KeyRelations | undefined,
): KeyRelations[] {
  const found = new Map<KeywordKey, KeyRelations>();
  for (const hit of focus.keywords) {
    if (hit.role !== role || found.has(hit.key)) continue;
    const relations = lookup(hit.key);
    if (relations !== undefined) found.set(hit.key, relations);
  }
  return [...found.values()];
}

function sideOf(
  focus: Trait,
  keys: readonly KeyRelations[],
  tiers: Tiers,
  eligible: (trait: Trait) => boolean,
): RelationSide {
  const linked = new Map<TraitId, { trait: Trait; links: KeyLink[] }>();
  const reached = new Set<KeywordKey>();
  for (const relations of keys) {
    for (const [strength, traits] of tiers(relations)) {
      for (const trait of traits) {
        if (trait.id === focus.id || !eligible(trait)) continue;
        const link = { key: relations.key, strength };
        const found = linked.get(trait.id);
        if (found === undefined) linked.set(trait.id, { trait, links: [link] });
        else found.links.push(link);
        reached.add(relations.key);
      }
    }
  }

  const related = [...linked.values()]
    .map(({ trait, links }): RelatedTrait => ({ trait, links, score: links.length, strength: strongest(links) }))
    .toSorted(byRank);
  const lanes = new Map<KeywordKey, RelatedTrait[]>();
  for (const entry of related) {
    const [only] = entry.links;
    if (only === undefined || entry.score >= SEVERAL_LINKS) continue;
    const lane = lanes.get(only.key);
    if (lane === undefined) lanes.set(only.key, [entry]);
    else lane.push(entry);
  }

  return {
    several: related.filter(({ score }) => score >= SEVERAL_LINKS),
    single: keys.flatMap(({ key }) => {
      const entries = lanes.get(key);
      return entries === undefined ? [] : [{ key, entries }];
    }),
    unmet: keys.map(({ key }) => key).filter((key) => !reached.has(key)),
    count: related.length,
  };
}

const rank = (strength: SourceStrength) => STRENGTHS.indexOf(strength);

function strongest(links: readonly KeyLink[]): SourceStrength {
  return links.reduce<SourceStrength>(
    (best, { strength }) => (rank(strength) < rank(best) ? strength : best),
    'random',
  );
}

function byRank(a: RelatedTrait, b: RelatedTrait): number {
  return rank(a.strength) - rank(b.strength) || b.score - a.score || compareTraitsByName(a.trait, b.trait);
}
