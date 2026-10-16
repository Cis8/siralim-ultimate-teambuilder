import { buff } from './entries';

/**
 * Transcribed on 2026-10-16 from the wiki's Buffs page (https://siralimultimate.wiki.gg/wiki/Buffs); the Codex
 * Reference (https://steamcommunity.com/sharedfiles/filedetails/?id=2197484456) lists the same eighteen.
 *
 * Barrier is a buff here, not a mechanic as in the prototypes: both sources say so, and so does the compendium
 * ("their Barrier buffs", Master of Cherubs).
 */
export const buffs = [
  buff('Agile'),
  buff('Arcane'),
  buff('Barrier'),
  buff('Berserk'),
  buff('Defensive'),
  buff('Immune'),
  buff('Invisible'),
  buff('Leeching'),
  buff('Mending'),
  buff('Proficient'),
  buff('Protected'),
  buff('Rebirth'),
  buff('Repelling'),
  buff('Savage'),
  buff('Shelled'),
  buff('Splashing'),
  buff('Taunting'),
  buff('Warded'),
] as const;
