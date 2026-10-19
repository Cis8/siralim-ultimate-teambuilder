import type { KeywordKey, KeywordRole, Trait, TraitId } from '../model/trait';
import type { KeyRelations } from './key-relations';
import { eligibleTraits, type RelationOptions } from './relation-options';
import { compareByOverlap } from './trait-order';

/** The roles in which two traits can be alike. Protection (`resists`) depends on nobody (GAME_RULES R9): it makes no tie. */
export type SharedRole = Exclude<KeywordRole, 'resists'>;

/** One key two traits have in common, and the role both have for it. */
export interface SharedKey {
  readonly key: KeywordKey;
  readonly role: SharedRole;
}

/** A trait that does what the focus does: it gives or relies on some of the same keys. */
export interface Alternative {
  readonly trait: Trait;
  /** What it shares with the focus, in the order the focus names it. Never empty: the more there is, the better the substitute. */
  readonly shared: readonly SharedKey[];
}

interface Tie extends SharedKey {
  readonly relations: KeyRelations;
}

/**
 * The other traits that apply a key the focus applies or rely on a key it relies on, ranked by how many such keys they have in
 * common, then by name. Only what a trait says by name counts, so a random or conditional source applies nothing here (as it
 * enables nobody, PLAN D27), and only buffs, debuffs and effects are keys (GAME_RULES R12). Pure: the index hands it its `get`.
 */
export function alternativesOfTrait(
  focus: Trait,
  lookup: (key: KeywordKey) => KeyRelations | undefined,
  options: RelationOptions,
): Alternative[] {
  const eligible = eligibleTraits(options);
  const found = new Map<TraitId, { trait: Trait; shared: SharedKey[] }>();
  for (const { key, role, relations } of tiesOf(focus, lookup)) {
    for (const trait of role === 'applies' ? relations.appliers : relations.users) {
      if (trait.id === focus.id || !eligible(trait)) continue;
      const tie = { key, role };
      const entry = found.get(trait.id);
      if (entry === undefined) found.set(trait.id, { trait, shared: [tie] });
      else entry.shared.push(tie);
    }
  }
  return [...found.values()].toSorted(compareByOverlap);
}

/** Each key the focus applies or relies on, once for each role, in the order it names them: a key the index lacks is no tie. */
function tiesOf(focus: Trait, lookup: (key: KeywordKey) => KeyRelations | undefined): Tie[] {
  const ties: Tie[] = [];
  for (const { key, role } of focus.keywords) {
    if (role !== 'applies' && role !== 'uses') continue;
    const relations = lookup(key);
    if (relations === undefined || ties.some((tie) => tie.key === key && tie.role === role)) continue;
    ties.push({ key, role, relations });
  }
  return ties;
}
