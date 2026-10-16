import { trigger } from './entries';

/**
 * When a trait does something, as in the prototypes (`TRIGS`), each with the phase of battle it belongs to. The
 * phrases are the ones the compendium writes: "start of battle" is not "start of this creature's turn".
 */
export const triggers = [
  trigger('start of battle', 'Start of battle', 'startOfBattle', ['start battles']),
  trigger("start of this creature's turn", 'Start of own turn', 'startOfTurn'),
  trigger("this creature's attacks", 'On attack (passive)', 'attacking'),
  trigger('when this creature attacks', 'When attacking', 'attacking'),
  trigger('after this creature attacks', 'After attacking', 'attacking'),
  trigger('deals critical damage', 'On critical hit', 'attacking'),
  trigger('after this creature is attacked', 'After being attacked', 'beingAttacked'),
  trigger('after an enemy dodges', 'After an enemy dodges', 'beingAttacked'),
  trigger('manually cast a spell', 'Manual spell cast', 'spellcasting', ['manually casts a spell']),
  trigger('kills a creature', 'On kill', 'killsAndDeaths'),
  trigger('is killed', 'On death', 'killsAndDeaths'),
] as const;
