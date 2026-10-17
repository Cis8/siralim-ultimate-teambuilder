import { mechanic } from './entries';

/** Game concepts a player searches for, as in the prototypes (`MECHS`). They have no applies/uses role. */
export const mechanics = [
  mechanic('minion', 'Minions', ['minion', 'minions']),
  mechanic('spell gems', 'Spell Gems', ['Spell Gems', 'Spell Gem']),
  mechanic('timeline', 'Timeline', ['Timeline']),
  mechanic('critical damage', 'Critical damage', ['critical damage']),
  mechanic('maximum health', 'Maximum health', ['maximum health']),
  // Properties of Spell Gems, and the second creature of a fusion: searched for, but nobody gives or relies on them.
  mechanic('charges', 'Charges', ['charges', 'charge']),
  mechanic('cascading', 'Cascading', ['Cascading']),
  mechanic('fused', 'Fused', ['Fused']),
  // Traits about spells that cast none, and about stats: searched for like the others (GAME_RULES R12, ADR-0009).
  mechanic('spells', 'Spells', ['spell', 'spells']),
  mechanic('stats', 'Stats', ['stat', 'stats']),
] as const;
