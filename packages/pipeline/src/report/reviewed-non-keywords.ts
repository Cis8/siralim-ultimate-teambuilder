/**
 * Capitalised terms in trait descriptions that were looked at and are no keyword, so that the taxonomy candidates in the
 * report keep to what is new. Reviewed on 2026-10-16 over compendium v2.0. Add a term when a candidate turns out to be
 * no mechanic; to make it a keyword, add an entry to the taxonomy instead.
 *
 * Still open, and so not listed: Sealed, Seals, Charges, Cascading (properties of Spell Gems), Fused (the second
 * creature of a fusion), and the stacking effects Mega Magic, Dire Wolves and Zombies.
 */
export const REVIEWED_NON_KEYWORDS: ReadonlySet<string> = new Set([
  // Stats
  'Attack',
  'Current',
  'Current Health',
  'Defense',
  'Health',
  'Intelligence',
  'Speed',
  // Classes
  'Chaos',
  'Death',
  'Life',
  'Nature',
  'Sorcery',
  // Gear and the slots of a creature or a Spell Gem
  'Artifact',
  'Artifacts',
  'Chance',
  'Spell Slot',
  'Stat Slots',
  // Spells by name and category
  'Arsenal Spell',
  'Arsenal Spells',
  'Booze Spells',
  'Fireball',
  'Snowstorm',
  'Ultimate',
  'Ultimate Spell',
  // What a creature is like
  'Personalities',
  'Personality',
]);
