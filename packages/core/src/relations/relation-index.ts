import { canBeDependency } from '../model/keyword-kind';
import type { KeywordKey, Trait, TraitId } from '../model/trait';
import type { Taxonomy } from '../taxonomy/registry';
import type { KeyRelations } from './key-relations';
import { relationsOfTrait, type RelationOptions, type TraitRelations } from './trait-relations';

/**
 * What the dataset says about who enables whom, built once when it is loaded. Only a buff, debuff or effect has an entry:
 * protection from it (`resists`) is no dependency (GAME_RULES R9), and no event, mechanic or flag is one (R12).
 */
export interface RelationIndex {
  /** Every key that can be a dependency, in the order of the taxonomy. */
  readonly keys: readonly KeywordKey[];
  /** `undefined` for a key that cannot be a dependency or that the taxonomy does not have. */
  get(key: KeywordKey): KeyRelations | undefined;
  /** What enables the trait and what it enables; `undefined` for an id the dataset does not have. */
  relationsOf(id: TraitId, options?: RelationOptions): TraitRelations | undefined;
}

type SourceList = 'appliers' | 'conditional' | 'random';

interface Lists {
  readonly appliers: Trait[];
  readonly conditional: Trait[];
  readonly random: Trait[];
  readonly users: Trait[];
}

/**
 * Lists, for each buff, debuff and effect of the taxonomy, the traits that apply it, those that apply it conditionally or
 * at random, and those that rely on it. Each list is in the order the traits were given. The taxonomy decides what a key is: a
 * mention of a key it does not have counts for nothing, whatever kind the trait gives it.
 */
export function createRelationIndex(traits: readonly Trait[], taxonomy: Taxonomy): RelationIndex {
  const dependencies = taxonomy.entries.filter((entry) => canBeDependency(entry.kind));
  const randomizable = dependencies.flatMap((entry) =>
    entry.kind === 'debuff' && entry.canBeRandomlyApplied ? [entry.key] : [],
  );
  const lists = new Map<KeywordKey, Lists>(
    dependencies.map((entry) => [entry.key, { appliers: [], conditional: [], random: [], users: [] }]),
  );

  for (const trait of traits) {
    for (const [key, list] of sourceLists(trait, lists, randomizable)) lists.get(key)?.[list].push(trait);
    for (const key of reliedOn(trait, lists)) lists.get(key)?.users.push(trait);
  }

  const relations = new Map<KeywordKey, KeyRelations>([...lists].map(([key, found]) => [key, { key, ...found }]));
  const byId = new Map<TraitId, Trait>(traits.map((trait) => [trait.id, trait]));
  const get = (key: KeywordKey) => relations.get(key);
  return {
    keys: dependencies.map(({ key }) => key),
    get,
    relationsOf(id, options = {}) {
      const focus = byId.get(id);
      return focus === undefined ? undefined : relationsOfTrait(focus, get, options);
    },
  };
}

/** The list of sources each key puts the trait in: the weakest way first, so a stronger one replaces it. */
function sourceLists(
  trait: Trait,
  known: ReadonlyMap<KeywordKey, unknown>,
  randomizable: readonly KeywordKey[],
): Map<KeywordKey, SourceList> {
  const lists = new Map<KeywordKey, SourceList>();
  if (trait.randomDebuff?.target === 'enemy') {
    for (const key of randomizable) lists.set(key, 'random');
  }
  for (const key of trait.conditionalSources) {
    if (known.has(key)) lists.set(key, 'conditional');
  }
  for (const hit of trait.keywords) {
    if (hit.role === 'applies' && known.has(hit.key)) lists.set(hit.key, 'appliers');
  }
  return lists;
}

function reliedOn(trait: Trait, known: ReadonlyMap<KeywordKey, unknown>): Set<KeywordKey> {
  return new Set(trait.keywords.filter((hit) => hit.role === 'uses' && known.has(hit.key)).map(({ key }) => key));
}
