import { debuff } from './entries';

/**
 * Transcribed on 2026-10-16 from the wiki's Debuffs page (https://siralimultimate.wiki.gg/wiki/Debuffs); the Codex
 * Reference (https://steamcommunity.com/sharedfiles/filedetails/?id=2197484456) lists the same twenty.
 *
 * Where compendium v2.0 spells one differently, v2.0 wins (GAME_RULES R8) and the entry keeps the canonical name:
 * the compendium says "Stoned" in 30 traits and "Stone" in 2, and "Sleep" once besides "Sleeping".
 *
 * The wiki marks Inverted and Mania as never applied by random-debuff effects; the rest can be.
 */
export const debuffs = [
  debuff('Bleeding'),
  debuff('Blighted'),
  debuff('Blind'),
  debuff('Bomb'),
  debuff('Burning'),
  debuff('Confused'),
  debuff('Cursed'),
  debuff('Disarmed'),
  debuff('Feared'),
  debuff('Frozen'),
  debuff('Inverted', { canBeRandomlyApplied: false }),
  debuff('Mania', { canBeRandomlyApplied: false }),
  debuff('Poisoned'),
  debuff('Scorned'),
  debuff('Silenced'),
  debuff('Sleeping', { patterns: ['Sleeping', 'Sleep'] }),
  debuff('Snared'),
  debuff('Stoned', { canonicalName: 'Stone', patterns: ['Stoned', 'Stone'] }),
  debuff('Vulnerable'),
  debuff('Weak'),
] as const;
