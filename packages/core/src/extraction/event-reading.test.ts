import { describe, expect, it } from 'vitest';
import { extractKeywords } from './extract-keywords';

/** `key:role/actor` for every event the extractor finds, in order; `actor` is left out where the text names none. */
function eventsIn(text: string): string[] {
  return extractKeywords(text)
    .filter((hit) => hit.kind === 'event')
    .map((hit) => `${hit.key}:${hit.role}${hit.actor === undefined ? '' : `/${hit.actor}`}`);
}

// Texts are quoted from compendium v2.0; the roles and actors are what a player reads in them (GAME_RULES R12).
describe('the role of an event mention', () => {
  describe('uses: the trait pays off when it happens', () => {
    it.each([
      ['the opening condition', 'After this creature is attacked, it gains a Barrier.', ['being attacked:uses/self']],
      ['"when"', 'When your creatures attack, they deal 20% more damage for each Weak enemy.', ['attack:uses/ally']],
      ['"if"', 'If this creature dies, your other creatures gain 10% attack.', ['death:uses/self']],
      ['"at"', 'At the start of battle, this creature gains a Barrier.', ['start of battle:uses']],
      [
        '"for each"',
        'This creature deals 5% more damage for each spell your creatures have cast.',
        ['cast spell:uses/ally'],
      ],
      ['"while"', 'While this creature is defending, it takes 50% less damage.', ['defend:uses/self']],
      [
        '"whenever"',
        'Whenever an enemy dodges, this creature recovers 10% health.',
        ['dodge:uses/enemy', 'heal:applies/self'],
      ],
    ])('reads %s', (_label, text, expected) => {
      expect(eventsIn(text)).toEqual(expected);
    });

    it('reads a possessive noun as a mention that counts or improves the event', () => {
      expect(eventsIn("This creature's attacks deal 75% more damage.")).toEqual(['attack:uses/self']);
      expect(eventsIn("Your creatures' dodges restore health.")).toEqual(['dodge:uses/ally']);
    });

    it('reads the second event of the opening condition the same way', () => {
      expect(eventsIn('When your creatures attack or cast a spell, they have a 5% chance to heal.')).toEqual([
        'attack:uses/ally',
        'cast spell:uses/ally',
        'heal:applies/ally',
      ]);
    });
  });

  describe('applies: the trait makes it happen', () => {
    it.each([
      ['an extra attack', 'Your creatures attack 1 additional time.', ['attack:applies/ally']],
      ['a spell', 'This creature has a 35% chance to cast a random Booze Spell.', ['cast spell:applies/self']],
      ['a resurrection', 'Your creatures have a 35% chance to be resurrected.', ['resurrection:applies/ally']],
      ['a kill', 'It has a 50% chance to kill the target.', ['kill:applies/self']],
      ['a provoke', 'This creature provokes and then it defends.', ['provoke:applies/self', 'defend:applies/self']],
    ])('reads %s', (_label, text, expected) => {
      expect(eventsIn(text)).toEqual(expected);
    });

    it('reads the effect of an opening condition as the trait’s own doing', () => {
      expect(eventsIn('After this creature attacks, it has a 25% chance to attack again.')).toEqual([
        'attack:uses/self',
        'attack:applies/self',
      ]);
    });
  });

  describe('resists: the trait prevents it', () => {
    it.each([
      ['"cannot"', 'This creature cannot be resurrected.', ['resurrection:resists/self']],
      ['"can\'t"', "Enemies can't dodge.", ['dodge:resists/enemy']],
      [
        '"cannot" then a verb',
        'This creature cannot manually attack, cast, defend, or provoke.',
        ['attack:resists/self', 'cast spell:resists/self', 'defend:resists/self', 'provoke:resists/self'],
      ],
    ])('reads %s', (_label, text, expected) => {
      expect(eventsIn(text)).toEqual(expected);
    });
  });
});

describe('more about the role of an event mention', () => {
  // The creature does not make a battle start: whatever it does at the start, it pays off on it.
  it('is always uses for the start of battle, whichever way it is written', () => {
    expect(eventsIn('Your Crusaders start battles with Shelled.')).toEqual(['start of battle:uses']);
    expect(eventsIn('This creature always starts battle at the top of the Timeline.')).toEqual([
      'start of battle:uses',
    ]);
    expect(eventsIn('At the start of battle, this creature gains a Barrier.')).toEqual(['start of battle:uses']);
  });

  // "deal 75% more damage with attacks" is about the attacks that happen, not a way to make one happen.
  it.each([
    ['after "with"', 'This creature deals additional damage with attacks and spells equal to 50% of its Defense.'],
    ['after "from"', 'This creature takes 2% less damage from attacks for every 1% health it is missing.'],
    ['after "an"', 'After this creature dodges an attack, it gains a Barrier.'],
    ['after a verb that takes it', 'Your creatures always dodge attacks and deal critical damage.'],
    ['after "each"', 'This trait can only activate on each attack.'],
  ])('reads a noun as uses: %s', (_label, text) => {
    const attack = extractKeywords(text).find((hit) => hit.key === 'attack');
    expect(attack?.role).toBe('uses');
  });

  it('still reads a verb as applies', () => {
    expect(eventsIn('Your creatures attack 1 additional time.')).toEqual(['attack:applies/ally']);
    expect(eventsIn('This creature has a 20% chance to attack a random enemy.')).toEqual(['attack:applies/self']);
  });

  it.each([
    ['a quantity', 'This creature receives 100% more healing from all sources.', 'heal:uses/self'],
    ['an amount', 'This creature gains Barrier equal to 50% of the amount healed.', 'heal:uses/self'],
    ['"for each"', 'This creature deals 50% more damage for each buff it has.', 'any buff:uses/self'],
    ['"that is"', 'It deals 100% more damage to targets that are defending or provoking.', 'defend:uses/enemy'],
    ['"that dies"', 'Enemies that die with Feared cannot be resurrected.', 'death:uses/enemy'],
    [
      '"the first 3 times"',
      'The first 3 times this creature is killed, it is resurrected with 100% health.',
      'death:uses/self',
    ],
  ])('reads %s as uses', (_label, text, expected) => {
    expect(eventsIn(text)).toContain(expected);
  });

  it('keeps the whole opening condition as one, even when it goes on after a comma and "or"', () => {
    const text =
      'When an adjacent creature would take attack or spell damage, or gain a buff or debuff, this creature takes the damage.';
    expect(eventsIn(text)).toContain('any buff:uses/any');
  });

  it('reads "can only" as a limit on the event, and "can only activate" as a condition of the trait', () => {
    expect(eventsIn('Enemies can only cast spells once at a time.')).toEqual(['cast spell:resists/enemy']);
    expect(eventsIn('This trait can only activate on the enemies first attack per turn.')).toEqual([
      'attack:uses/enemy',
    ]);
  });

  it('reads "that enemy" as the enemy doing it, not as a description of one', () => {
    expect(eventsIn('This creature attacks an enemy. Then, that enemy attacks this creature.')).toEqual([
      'attack:applies/self',
      'attack:applies/enemy',
    ]);
  });

  it('reads a death that things persist through as the one they are counted on', () => {
    expect(eventsIn("This creature's stat changes persist through death.")).toEqual(['death:uses/self']);
  });

  it('does not carry the role of a noun over to the verb after it', () => {
    expect(
      eventsIn('This creature has a 20% chance to dodge attacks and deal critical damage for each debuff.'),
    ).toEqual(['dodge:applies/self', 'attack:uses/self', 'critical hit:applies/self', 'any debuff:uses/self']);
  });

  it('carries a prevention over a list of verbs, and so a condition', () => {
    expect(eventsIn('This creature cannot manually attack, cast, defend, or provoke.')).toEqual([
      'attack:resists/self',
      'cast spell:resists/self',
      'defend:resists/self',
      'provoke:resists/self',
    ]);
    expect(eventsIn('When your creatures attack, cast or defend, they gain Barrier.')).toEqual([
      'attack:uses/ally',
      'cast spell:uses/ally',
      'defend:uses/ally',
    ]);
  });

  it('ends a prevention at "but"', () => {
    expect(eventsIn('This creature cannot dodge but gains Barrier when it takes damage.')).toEqual([
      'dodge:resists/self',
      'damage taken:uses/self',
    ]);
  });

  it('reads both edges of "at the start and end of their turn" as the condition they are', () => {
    expect(eventsIn('Enemies are afflicted with Weak at the start and end of their turn.')).toEqual([
      'start of turn:uses/enemy',
      'end of turn:uses/enemy',
    ]);
  });

  it('stops a prevention at the next thing the sentence says', () => {
    expect(eventsIn('Your attacks cannot be dodged and have a 50% greater chance to deal critical damage.')).toEqual([
      'attack:uses/ally',
      'dodge:resists/ally',
      'critical hit:applies/ally',
    ]);
  });
});

describe('the actor of an event mention', () => {
  it.each([
    ['this creature', 'After this creature attacks an enemy with Vulnerable, it deals 100% more damage.', 'self'],
    ['"it"', 'This creature attacks, then it casts Fireball.', 'self'],
    ['your creatures', 'After your creatures cast a spell, they gain Berserk.', 'ally'],
    ['a family of yours', 'After one of your Efts attack, all of your Efts recover health.', 'ally'],
    ['an ally', 'When an ally dies, this creature gains 10% speed.', 'ally'],
    ['an enemy', 'After an enemy casts a spell on all your creatures, this creature recovers health.', 'enemy'],
    ['enemies', 'When enemies attack, this creature dodges.', 'enemy'],
    ['any creature', 'When a creature dies, this creature gains 10% attack.', 'any'],
    ['all creatures', 'When all creatures attack, it gains a Barrier.', 'any'],
  ])('is read from the subject: %s', (_label, text, actor) => {
    expect(extractKeywords(text).find((hit) => hit.kind === 'event')?.actor).toBe(actor);
  });

  it('is the nearest subject before the event in its clause, not the one the sentence starts with', () => {
    expect(eventsIn('When this creature attacks an enemy, your other creatures cast a spell.')).toEqual([
      'attack:uses/self',
      'cast spell:applies/ally',
    ]);
  });

  it('is the creature the thing happens to, for an event that happens to somebody', () => {
    expect(eventsIn('When an enemy is killed, your creatures recover 10% health.')).toEqual([
      'death:uses/enemy',
      'heal:applies/ally',
    ]);
    expect(eventsIn('If this creature is resurrected, it gains Berserk.')).toEqual(['resurrection:uses/self']);
  });

  it('is not named by a text that names nobody', () => {
    expect(eventsIn('At the start of battle, a random creature gains Berserk.')).toEqual(['start of battle:uses']);
  });

  it('is the owner of the turn when the words name one, whatever the sentence says', () => {
    expect(eventsIn("At the start of your Phoenixes' turns, this creature heals.")).toEqual([
      'start of turn:uses/ally',
      'heal:applies/self',
    ]);
    expect(eventsIn("At the end of each enemy's turn, this creature deals damage.")).toEqual([
      'end of turn:uses/enemy',
    ]);
  });

  it('is the subject of the sentence for "their turn", which names nobody', () => {
    expect(eventsIn('Enemies take damage at the end of their turn.')).toEqual([
      'damage taken:applies/enemy',
      'end of turn:uses/enemy',
    ]);
  });

  it('is nobody for the start of battle: it is a moment, not something a creature does', () => {
    expect(eventsIn('Your Crusaders start battles with Shelled.')).toEqual(['start of battle:uses']);
  });

  it.each([
    [
      'a family and "creatures"',
      'After one of your Griffons creatures attack, this creature attacks a random enemy.',
      'ally',
    ],
    [
      '"your other" and a family',
      'When your Carnages kill an enemy, your other Carnages attack a random enemy.',
      'ally',
    ],
    ['"enemy creatures"', 'After the enemy creatures cast a spell, this creature heals.', 'enemy'],
    ['creatures next to this one', 'Your creatures adjacent to this creature attack 2 additional times.', 'ally'],
  ])('is read from %s', (_label, text, actor) => {
    expect(extractKeywords(text).find((hit) => hit.kind === 'event')?.actor).toBe(actor);
  });

  it('is any creature for a spell that was cast by nobody in particular', () => {
    expect(
      eventsIn('This creature deals 5% more damage for each spell that has been cast in the current battle.'),
    ).toEqual(['cast spell:uses/any']);
    expect(eventsIn('It casts the last spell that any creature cast in the current battle.')).toEqual([
      'cast spell:applies/self',
      'cast spell:uses/any',
    ]);
  });

  it('is who has the thing counted, when the count names them right after', () => {
    expect(eventsIn('This creature deals 5% more damage for each debuff the enemy has.')).toEqual([
      'any debuff:uses/enemy',
    ]);
  });

  it('is the creatures whose spells they are, when the spells do the casting', () => {
    expect(eventsIn("Your creatures' Nature spells cast 1 additional time.")).toEqual(['cast spell:applies/ally']);
  });

  it('is the one after "by" for an event with a passive verb', () => {
    expect(
      eventsIn('For each spell that has been cast by all creatures in the current battle, it gains Attack.'),
    ).toEqual(['cast spell:uses/any']);
  });

  // "it" and "they" stand for somebody named earlier: the first one of their number the sentence names.
  it.each([
    [
      '"it" for the enemy of the condition',
      'After an enemy loses stats, it is afflicted with a random debuff.',
      'any debuff:applies/enemy',
    ],
    [
      '"it" for the creature, not for what it attacks',
      'When this creature attacks an enemy, it casts a spell.',
      'cast spell:applies/self',
    ],
    ['"they" for the creatures of the condition', 'When your creatures kill an enemy, they heal.', 'heal:applies/ally'],
    ['"they" for each enemy', "At the end of each enemy's turn, they cast a spell.", 'cast spell:applies/enemy'],
    [
      '"it" for an enemy, whatever this creature does to it',
      'When an enemy gains stats, this creature afflicts it with a random debuff.',
      'any debuff:applies/enemy',
    ],
  ])('is who the pronoun stands for: %s', (_label, text, expected) => {
    expect(eventsIn(text)).toContain(expected);
  });

  it('is the one enemy named when "they" has nobody else to stand for', () => {
    expect(
      eventsIn('After an enemy dodges an attack, they take damage equal to 30% of their Current health.'),
    ).toContain('damage taken:applies/enemy');
  });

  it('is who has the thing counted, even when the count says "they"', () => {
    expect(eventsIn('Enemies take 25% more damage for each debuff they have.')).toContain('any debuff:uses/enemy');
  });

  it('is your creatures for "the creatures in your party"', () => {
    expect(eventsIn('If all the creatures in your party are Efts, they have a 40% chance to dodge.')).toEqual([
      'dodge:applies/ally',
    ]);
  });

  it('is this creature for "it" when nobody else is named', () => {
    expect(eventsIn('At the start of battle, it casts a spell.')).toContain('cast spell:applies/self');
  });

  it('is read from the subject in the sentence when the clause has none', () => {
    expect(eventsIn('Your creatures dodge, which heals them.')).toEqual(['dodge:applies/ally', 'heal:applies/ally']);
  });
});

describe('what is no event', () => {
  it('is the stat called attack', () => {
    expect(eventsIn('This creature has 15% more attack and intelligence.')).toEqual([]);
  });
});
