import type { KeywordKey, KeywordRole, Trait, TraitId } from '../model/trait';
import { SLOT_POSITIONS, traitAt, type Party, type SlotPosition } from './party';

/** The trait an id stands for, or `undefined` when the dataset does not know it (a party can come from another version). */
export type TraitLookup = (id: TraitId) => Trait | undefined;

/**
 * Phase 1 knows two statuses: someone in the party applies the buff, debuff or effect, or nobody does. The random and
 * conditional sources (GAME_RULES R5, R10) and the inactive masteries (R3) refine *missing* in Phase 3.
 */
export type DependencyStatus = 'covered' | 'missing';

/** A buff, debuff or effect that at least one trait of the party relies on. */
export interface Dependency {
  readonly key: KeywordKey;
  readonly status: DependencyStatus;
}

/** A non-stacking trait that sits in the party more than once: only one copy has an effect (GAME_RULES R4). */
export interface DuplicateTrait {
  readonly trait: Trait;
  /** Where its copies are, in reading order: at least two. */
  readonly positions: readonly SlotPosition[];
}

export interface PartyCoverage {
  /** What the traits of the party apply, once each, in the order of the slots. */
  readonly applies: readonly KeywordKey[];
  /** What the traits of the party rely on, once each, in the order of the slots. */
  readonly relies: readonly Dependency[];
  /** In the order their first copy appears. */
  readonly duplicates: readonly DuplicateTrait[];
}

interface Placed {
  readonly at: SlotPosition;
  readonly trait: Trait;
}

/**
 * What the party gives and what it needs. A mention that only guards against a keyword (`resists`) is neither (GAME_RULES
 * R9), and every mastery counts as a source (D6). An id the lookup does not know is passed over.
 */
export function partyCoverage(party: Party, lookup: TraitLookup): PartyCoverage {
  const placed = placedTraits(party, lookup);
  const applies = keysWithRole(placed, 'applies');
  const applied = new Set(applies);
  return {
    applies,
    relies: keysWithRole(placed, 'uses').map((key) => ({ key, status: applied.has(key) ? 'covered' : 'missing' })),
    duplicates: duplicatesOf(placed),
  };
}

function placedTraits(party: Party, lookup: TraitLookup): Placed[] {
  return SLOT_POSITIONS.flatMap((at) => {
    const id = traitAt(party, at);
    const trait = id === null ? undefined : lookup(id);
    return trait === undefined ? [] : [{ at, trait }];
  });
}

/** The keys the traits mention with that role, once each, in the order they are met. */
function keysWithRole(placed: readonly Placed[], role: KeywordRole): KeywordKey[] {
  const keys = placed.flatMap(({ trait }) => trait.keywords.filter((hit) => hit.role === role).map((hit) => hit.key));
  return [...new Set(keys)];
}

function duplicatesOf(placed: readonly Placed[]): DuplicateTrait[] {
  const copies = new Map<TraitId, { trait: Trait; positions: SlotPosition[] }>();
  for (const { at, trait } of placed) {
    if (trait.stacks) continue;
    const found = copies.get(trait.id);
    if (found === undefined) copies.set(trait.id, { trait, positions: [at] });
    else found.positions.push(at);
  }
  return [...copies.values()].filter(({ positions }) => positions.length > 1);
}
