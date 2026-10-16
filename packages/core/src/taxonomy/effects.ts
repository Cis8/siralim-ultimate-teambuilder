import { effect } from './entries';

/**
 * What builds are made of beyond the canonical buffs and debuffs (GAME_RULES R11), found in the compendium rather than
 * in the wiki lists: traits give them ("gains 3 stacks of Dire Wolves"), rely on them ("for each Sealed Spell Gem") or
 * guard against them ("cannot be Sealed"), so they have a role like a buff.
 *
 * Sealed is also a verb: "Seals one of the target's Spell Gems" is the trait sealing, which `activePatterns` says.
 */
export const effects = [
  effect('Sealed', { patterns: ['Sealed', 'Seals', 'Seal'], activePatterns: ['Seals', 'Seal'] }),
  effect('Mega Magic'),
  effect('Dire Wolves'),
  effect('Zombies'),
] as const;
