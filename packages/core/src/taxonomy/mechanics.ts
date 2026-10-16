import { mechanic } from './entries';

/** Game concepts a player searches for, as in the prototypes (`MECHS`). They have no applies/uses role. */
export const mechanics = [
  mechanic('minion', 'Minions', ['minion', 'minions']),
  mechanic('spell gems', 'Spell Gems', ['Spell Gems', 'Spell Gem']),
  mechanic('timeline', 'Timeline', ['Timeline']),
  mechanic('critical damage', 'Critical damage', ['critical damage']),
  mechanic('maximum health', 'Maximum health', ['maximum health']),
] as const;
