/**
 * Capitalised terms in trait descriptions that were looked at and are no keyword, so that the taxonomy candidates in the
 * report keep to what is new. Reviewed on 2026-10-16 over compendium v2.0, and again on 2026-10-17 when Spells and Stats became keywords. Add a term when a candidate turns out to be
 * no mechanic; to make it a keyword, add an entry to the taxonomy instead.
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
  'Slot',
  'Slots',
  // Spells by name and category ("Arsenal Spells": the keyword Spells covers the second word)
  'Arsenal',
  'Booze',
  'Fireball',
  'Snowstorm',
  'Ultimate',
  // What a creature is like
  'Personalities',
  'Personality',
]);
