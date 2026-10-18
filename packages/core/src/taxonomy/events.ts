import { event } from './entries';

/**
 * What happens in battle (GAME_RULES R12, ADR-0009), after the categories the game's own texts name, each with the phase of
 * battle it belongs to. A trait causes an event, pays off when it happens or prevents it, and a creature does or suffers it:
 * the role and the actor are read from the text around the mention, so the patterns here are only the words that name it,
 * every inflection of them.
 *
 * `aliases` are the trigger phrases of the first version of the app, which an address or a query may still carry.
 */
export const events = [
  event('start of battle', 'Start of battle', {
    group: 'battle',
    phase: 'startOfBattle',
    moment: true,
    patterns: [
      'start of battle',
      'start-of-battle',
      'start battle',
      'start battles',
      'starts battle',
      'starts battles',
    ],
  }),
  // The turns are read by a grammar ("start of <whose> turn"): the possessive can be a family ("your Phoenixes' turns").
  event('start of turn', 'Start of turn', {
    group: 'battle',
    phase: 'startOfTurn',
    turnEdge: 'start',
    patterns: ['start-of-turn'],
    aliases: [{ key: "start of this creature's turn", actor: 'self' }],
  }),
  event('end of turn', 'End of turn', {
    group: 'battle',
    phase: 'endOfTurn',
    turnEdge: 'end',
    patterns: ['end-of-turn'],
  }),
  // "attacked" alone is the attack in the past ("for each time it attacked"); done to a creature it is the next entry.
  event('attack', 'Attack', {
    group: 'actions',
    phase: 'attacking',
    patterns: ['attack', 'attacks', 'attacking', 'attacked', 'on-attack'],
    statPatterns: ['attack'],
    aliases: [
      { key: "this creature's attacks", actor: 'self' },
      { key: 'when this creature attacks', actor: 'self' },
      { key: 'after this creature attacks', actor: 'self' },
    ],
  }),
  event('cast spell', 'Cast spell', {
    group: 'actions',
    phase: 'spellcasting',
    patterns: ['cast', 'casts', 'casting', 'on-cast'],
  }),
  event('manual cast', 'Manual cast', {
    group: 'actions',
    phase: 'spellcasting',
    patterns: ['manually cast', 'manually casts', 'cast spells manually', 'cast manually', 'manually casting'],
    aliases: [{ key: 'manually cast a spell' }, { key: 'manually casts a spell' }],
  }),
  event('defend', 'Defend', {
    group: 'actions',
    phase: 'defending',
    patterns: ['defend', 'defends', 'defended', 'defending', 'on-defend'],
  }),
  event('provoke', 'Provoke', {
    group: 'actions',
    phase: 'defending',
    patterns: ['provoke', 'provokes', 'provoked', 'provoking', 'on-provoke'],
  }),
  event('being attacked', 'Being attacked', {
    group: 'hits',
    phase: 'beingAttacked',
    patterns: [
      'is attacked',
      'are attacked',
      'was attacked',
      'were attacked',
      'be attacked',
      'been attacked',
      'being attacked',
      'get attacked',
      'gets attacked',
      'attacked by',
      'when-attacked',
    ],
    aliases: [{ key: 'after this creature is attacked', actor: 'self' }],
  }),
  event('dodge', 'Dodge', {
    group: 'hits',
    phase: 'beingAttacked',
    patterns: ['dodge', 'dodges', 'dodged', 'dodging', 'on-dodge'],
    aliases: [{ key: 'after an enemy dodges', actor: 'enemy' }],
  }),
  event('critical hit', 'Critical hit', {
    group: 'hits',
    phase: 'attacking',
    patterns: [
      'deal critical damage',
      'deals critical damage',
      'dealt critical damage',
      'dealing critical damage',
      'on-critical',
    ],
    aliases: [{ key: 'deals critical damage' }],
  }),
  event('damage taken', 'Damage taken', {
    group: 'hits',
    phase: 'beingAttacked',
    patterns: [
      'takes damage',
      'take damage',
      'taken damage',
      'took damage',
      'taking damage',
      'takes indirect damage',
      'take indirect damage',
      'is damaged',
      'are damaged',
      'damaged by',
    ],
  }),
  event('heal', 'Heal', {
    group: 'life',
    patterns: ['heal', 'heals', 'healed', 'healing', 'recover', 'recovers', 'recovered'],
  }),
  event('kill', 'Kill', {
    group: 'life',
    phase: 'killsAndDeaths',
    patterns: ['kill', 'kills', 'killing'],
    aliases: [{ key: 'kills a creature' }],
  }),
  event('death', 'Death', {
    group: 'life',
    phase: 'killsAndDeaths',
    patterns: ['die', 'dies', 'died', 'dying', 'dead', 'death', 'killed', 'on-death'],
    aliases: [{ key: 'is killed' }],
  }),
  event('resurrection', 'Resurrection', {
    group: 'life',
    phase: 'killsAndDeaths',
    patterns: ['resurrect', 'resurrects', 'resurrected', 'resurrection', 'resurrecting', 'on-resurrect'],
  }),
  event('any buff', 'Any buff', {
    group: 'buffs',
    patterns: [
      'each buff',
      'every buff',
      'buffs it has',
      'buffs they have',
      'a buff or debuff',
      'an additional random buff',
      'gain a buff',
      'gains a buff',
      'gained a buff',
      'receive a buff',
      'receives a buff',
      'gain a random buff',
      'gains a random buff',
      'gains buffs',
      'gain buffs',
      'on-buff',
    ],
  }),
  event('any debuff', 'Any debuff', {
    group: 'buffs',
    patterns: [
      'each debuff',
      'every debuff',
      'debuffs it has',
      'debuffs they have',
      'every 2 debuffs',
      'an additional random debuff',
      'a random debuff instead',
      'afflicted with a debuff',
      'afflicted with a random debuff',
      'afflicted with debuffs',
      'afflicted with random debuffs',
      'with a random debuff',
      'a random debuff',
    ],
  }),
] as const;
