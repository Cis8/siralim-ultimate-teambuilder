import type { TraitKind, TraitRow } from '../model/trait';

/** The five classes a creature can have (GAME_RULES R7). Any other class is not a creature. */
export const CREATURE_CLASSES: ReadonlySet<string> = new Set(['Chaos', 'Death', 'Life', 'Nature', 'Sorcery']);

/**
 * Every class compendium v2.0 uses (GAME_RULES R7): the creature classes, the classes of mastery and backer traits,
 * and those of the artifact-only `other` kind. A class outside this set is new, and gets reported.
 */
export const KNOWN_CLASSES: ReadonlySet<string> = new Set([
  ...CREATURE_CLASSES,
  'Rodian Master',
  'Backer',
  'Nether Boss',
  'Boss',
  'Pandemonium',
  'Nether Room',
]);

/** Values of the Creature column that say a row is not a creature at all. */
export const MASTERY_CREATURE = 'Mastery Trait';
export const BACKER_CREATURE = 'Backer Trait';

/** Creatures of this family are Avatars: innate-only (GAME_RULES R6). */
export const AVATAR_FAMILY = 'Avatar';

/**
 * Which kind of trait a row is (GAME_RULES R7). A class never seen before is `other`, i.e. artifact-only, until the
 * owner says otherwise.
 */
export function classifyKind(row: Pick<TraitRow, 'class' | 'family' | 'creature'>): TraitKind {
  if (row.creature === MASTERY_CREATURE) return 'mastery';
  if (row.creature === BACKER_CREATURE) return 'backer';
  if (!CREATURE_CLASSES.has(row.class)) return 'other';
  return row.family === AVATAR_FAMILY ? 'avatar' : 'creature';
}
