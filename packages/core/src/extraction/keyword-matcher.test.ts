import { describe, expect, it } from 'vitest';
import { createTaxonomy } from '../taxonomy/registry';
import { taxonomy } from '../taxonomy/taxonomy';
import { createKeywordMatcher } from './keyword-matcher';

const matcher = createKeywordMatcher(taxonomy);
const keysIn = (text: string) => matcher.match(text).map((match) => match.key);

describe('createKeywordMatcher', () => {
  it('finds a keyword with its kind and the span it covers', () => {
    expect(matcher.match('Enemies with Vulnerable take more damage.')).toEqual([
      { key: 'vulnerable', kind: 'debuff', span: [13, 23] },
    ]);
  });

  it('gives spans that cut the keyword out of the original text', () => {
    const text = 'At the start of battle, this creature gains a Barrier and Shelled.';
    const found = matcher.match(text).map(({ key, span }) => [key, text.slice(span[0], span[1])]);
    expect(found).toEqual([
      ['start of battle', 'start of battle'],
      ['barrier', 'Barrier'],
      ['shelled', 'Shelled'],
    ]);
  });

  it('finds nothing in text without keywords, or in no text', () => {
    expect(matcher.match('This creature deals 10% more damage.')).toEqual([]);
    expect(matcher.match('')).toEqual([]);
  });

  describe('letter case', () => {
    it.each(['start of battle', 'Start of battle', 'START OF BATTLE'])('is ignored in a phrase: %s', (written) => {
      expect(keysIn(`${written}, it rests.`)).toEqual(['start of battle']);
    });

    it('is ignored in a mechanic: "spell gems" and "Spell Gems"', () => {
      expect(keysIn('See spell gems. See Spell Gems.')).toEqual(['spell gems', 'spell gems']);
    });

    it('matters for a buff or debuff, which is a name: only the written form counts', () => {
      expect(keysIn('Enemies with Weak rest.')).toEqual(['weak']);
      expect(keysIn('Enemies with weak rest.')).toEqual([]);
      expect(keysIn('Enemies with WEAK rest.')).toEqual([]);
    });

    it.each([
      ['are immune to Silenced', ['silenced']],
      ['are immune to damage from effects', []],
      ['gain Immune', ['immune']],
      ['creatures that are weak against their class', []],
    ])('keeps an adjective from being a status: "%s"', (text, keys) => {
      expect(keysIn(`Your creatures ${text}.`)).toEqual(keys);
    });
  });

  describe('events (GAME_RULES R12)', () => {
    it.each([
      ['This creature attacks twice', 'attack'],
      ['Attacking enemies', 'attack'],
      ['their on-attack effects', 'attack'],
      ['an enemy is attacked', 'being attacked'],
      ['it casts Fireball', 'cast spell'],
      ['on-cast effects', 'cast spell'],
      ['it manually casts Fireball', 'manual cast'],
      ['your creatures defend', 'defend'],
      ['it provokes', 'provoke'],
      ['an enemy dodges', 'dodge'],
      ['it deals critical damage', 'critical hit'],
      ['when it takes damage', 'damage taken'],
      ['it heals 10% health', 'heal'],
      ['it kills the target', 'kill'],
      ['when it dies', 'death'],
      ['when it is killed', 'death'],
      ['it is resurrected', 'resurrection'],
      ['it gains a random buff', 'any buff'],
      ['it is afflicted with a random debuff', 'any debuff'],
    ])('finds the event in "%s"', (text, key) => {
      expect(matcher.match(text).filter((match) => match.kind === 'event')).toEqual([
        expect.objectContaining({ key, kind: 'event' }),
      ]);
    });

    it('prefers the longer phrase: "manually cast" is a manual cast, not a cast', () => {
      expect(keysIn('it manually cast Fireball')).toEqual(['manual cast']);
    });

    it('ignores letter case', () => {
      expect(keysIn('Attacks. ATTACKS. attacks.')).toEqual(['attack', 'attack', 'attack']);
    });

    it('reads the edges of a turn by the grammar, with the owner when the words name one', () => {
      const text = "At the start of your Phoenixes' turns and at the end of each enemy's turn, it rests.";
      expect(matcher.match(text).map(({ key, span, actor }) => [key, text.slice(span[0], span[1]), actor])).toEqual([
        ['start of turn', "start of your Phoenixes' turns", 'ally'],
        ['end of turn', "end of each enemy's turn", 'enemy'],
      ]);
    });

    it('gives the turn of "their" no owner: the sentence around it has to say', () => {
      expect(matcher.match('at the end of their turn')).toEqual([{ key: 'end of turn', kind: 'event', span: [7, 24] }]);
    });

    it('reads "the start and end of their turn" as both edges', () => {
      expect(keysIn('at the start and end of their turn')).toEqual(['start of turn', 'end of turn']);
    });

    it('reads the hyphenated forms of the turns', () => {
      expect(keysIn('their start-of-turn and end-of-turn effects')).toEqual(['start of turn', 'end of turn']);
    });

    // The words of a turn can name a status ("each Cursed enemy's turn"): the status is a mention of its own, and the turn
    // keeps the words before it, so that no span overlaps another.
    it('keeps a status named inside a turn, and shortens the turn to the words before it', () => {
      const text = "At the start of each Cursed enemy's turn, it rests.";
      expect(matcher.match(text).map(({ key, span, actor }) => [key, text.slice(span[0], span[1]), actor])).toEqual([
        ['start of turn', 'start of each', 'enemy'],
        ['cursed', 'Cursed', undefined],
      ]);
    });

    it('drops the turn when the status starts it', () => {
      expect(keysIn('Cursed turns end')).toEqual(['cursed']);
    });

    it('reads "its turn ends" as the end of a turn', () => {
      expect(keysIn('it defends and then its turn ends')).toEqual(['defend', 'end of turn']);
    });

    it('does not read a turn out of a phrase that is not one', () => {
      expect(keysIn('This creature can take an additional turn.')).toEqual([]);
    });

    // "Death" is a class, "Healing" and "Kill Streak" are spells: a name is capitalised in the middle of a sentence.
    describe('a name that looks like an event', () => {
      it.each([
        'Your Death creatures take 10% less damage.',
        'This creature casts Death Siphon on the target.',
        'It gains Major Healing at the start of battle.',
        'Then it casts Kill Streak.',
        'Chaos, Sorcery, Nature, Death, or Life Spell Gems',
      ])('is no event: %s', (text) => {
        const events = matcher.match(text).filter((match) => match.kind === 'event' && match.key !== 'start of battle');
        expect(events.map((match) => text.slice(match.span[0], match.span[1]))).not.toContain('Death');
        expect(events.map((match) => text.slice(match.span[0], match.span[1]))).not.toContain('Healing');
        expect(events.map((match) => text.slice(match.span[0], match.span[1]))).not.toContain('Kill');
      });

      it.each(['Attack a random enemy.', 'After it hits. Heal one ally.', 'When this creature dies. Death follows.'])(
        'is an event at the start of a sentence: %s',
        (text) => {
          expect(keysIn(text).length).toBeGreaterThan(0);
        },
      );

      it('is an event after a dash, and no event as the label of a list', () => {
        expect(keysIn('Chaos - Attack a random enemy. Death - Enemies are afflicted with Weak.')).toEqual([
          'attack',
          'weak',
        ]);
      });

      it('is an event at the start of the next sentence', () => {
        expect(keysIn('It rests. Death follows.')).toEqual(['death']);
      });
    });

    describe('"attacked": the attack when the creature did it, being attacked when it was done to it', () => {
      it.each([
        ['After this creature is attacked, it gains a Barrier.', 'being attacked'],
        ['When your creatures are attacked, they heal.', 'being attacked'],
        ['If this creature was attacked last turn', 'being attacked'],
        ['their on-attack and when-attacked effects', 'attack'],
        ['for each time they have attacked in the current battle', 'attack'],
        ['if it attacked last turn', 'attack'],
        ['the damage it took since it last attacked', 'attack'],
      ])('reads %s', (text, key) => {
        expect(matcher.match(text).map((match) => match.key)).toContain(key);
      });

      it('reads "when-attacked" as being attacked', () => {
        expect(keysIn('their when-attacked effects')).toEqual(['being attacked']);
      });
    });

    describe('"attack" as a stat', () => {
      it.each([
        'This creature has 15% more attack and intelligence.',
        "It reduces the enemies' attack by 15%.",
        'It gains Attack equal to 20% of the damage.',
        'Its stats other than attack are doubled.',
      ])('is no event: %s', (text) => {
        expect(keysIn(text).filter((key) => key === 'attack')).toEqual([]);
      });

      it('is never the stat in the plural, and an action as a verb', () => {
        expect(keysIn('Its attacks deal 75% more damage.')).toEqual(['attack']);
        expect(keysIn('Your creatures attack 1 additional time.')).toEqual(['attack']);
      });

      it('is only a stat where the entry says so: a word of another event keeps its meaning', () => {
        const custom = createKeywordMatcher(
          createTaxonomy([
            {
              kind: 'event',
              key: 'attack',
              label: 'Attack',
              patterns: ['attack', 'strike'],
              group: 'actions',
              statPatterns: ['attack'],
            },
          ]),
        );
        expect(custom.match('15% more attack and a strike').map((match) => match.span)).toEqual([[22, 28]]);
      });
    });
  });

  describe('effects and the Spell Gem mechanics', () => {
    it.each([
      ['it Seals one of their Spell Gems', ['sealed', 'spell gems']],
      ['that Spell Gem is Sealed', ['spell gems', 'sealed']],
      ['no Spell Gems can be sealed', ['spell gems', 'sealed']],
      ['gains 3 stacks of Dire Wolves', ['dire wolves']],
      ['start battles with 1 Zombies', ['start of battle', 'zombies']],
      ['this creature gains Mega Magic', ['mega magic']],
      ['their Spell Gems gain 1 charge and 2 Charges', ['spell gems', 'charges', 'charges']],
      ['the "Cascading" property of a Fused creature', ['cascading', 'fused']],
    ])('finds the keywords of "%s"', (text, keys) => {
      expect(keysIn(text)).toEqual(keys);
    });

    it('ignores letter case for an effect: they are not proper names the way a buff is', () => {
      expect(keysIn('no Spell Gems can be sealed')).toContain('sealed');
      expect(keysIn('Sealed Spell Gems')).toEqual(['sealed', 'spell gems']);
    });

    it('does not take a word that merely starts like one for it', () => {
      expect(keysIn('Sealing the deal with Chargers and Zombie-like Wolves')).toEqual([]);
    });
  });

  describe('whole words', () => {
    it.each([
      ['Weakness', 'weak'],
      ['weaknesses', 'weak'],
      ['Maniacs', 'mania'],
      ['Maniac', 'mania'],
      ['Stones', 'stoned'],
      ['Sleepwalking', 'sleeping'],
      ['Barriers', 'barrier'],
      ['Unshelled', 'shelled'],
      ['Bombard', 'bomb'],
    ])('does not read a keyword inside %s', (word, key) => {
      expect(keysIn(`Your ${word} rest.`)).not.toContain(key);
    });

    it('does not take a status for part of a longer name: "Savage Spores" is not Savage', () => {
      expect(keysIn('At the start of battle, this creature gains Savage Spores.')).toEqual(['start of battle']);
      expect(keysIn('Frozen Nova hits Weak Enemies.')).toEqual([]);
    });

    it('still reads a status followed by a lower-case word, a punctuation mark or another status', () => {
      expect(keysIn('Weak enemies with Snared and Feared.')).toEqual(['weak', 'snared', 'feared']);
      expect(keysIn('It gains Savage, Berserk and Agile creatures.')).toEqual(['savage', 'berserk', 'agile']);
      expect(keysIn('Afflicts Weak. Then it rests.')).toEqual(['weak']);
    });

    it('still finds a keyword next to punctuation', () => {
      expect(keysIn('(Weak), Vulnerable. Snared; "Feared"!')).toEqual(['weak', 'vulnerable', 'snared', 'feared']);
    });

    it('finds a keyword at the very start and the very end of the text', () => {
      expect(matcher.match('Weak')).toEqual([{ key: 'weak', kind: 'debuff', span: [0, 4] }]);
      expect(keysIn('Is Weak')).toEqual(['weak']);
    });
  });

  describe('longest match', () => {
    it('reads "start of battle" and the start of a turn as different events', () => {
      expect(keysIn("At the start of battle and at the start of this creature's turn, it rests.")).toEqual([
        'start of battle',
        'start of turn',
      ]);
    });

    it('reads Sleeping as one keyword, not Sleep followed by "ing"', () => {
      expect(matcher.match('Your creatures with Sleeping rest.')).toEqual([
        { key: 'sleeping', kind: 'debuff', span: [20, 28] },
      ]);
    });

    it('prefers the longer phrase when one contains the other', () => {
      const overlapping = createKeywordMatcher(
        createTaxonomy([
          { kind: 'mechanic', key: 'spellcasting', label: 'Spell', patterns: ['spell'] },
          { kind: 'mechanic', key: 'spell gems', label: 'Spell Gems', patterns: ['spell gems'] },
        ]),
      );
      expect(overlapping.match('Seal spell gems and a spell.').map((match) => match.key)).toEqual([
        'spell gems',
        'spellcasting',
      ]);
    });

    it('does not report matches that overlap', () => {
      const text = 'It starts the start of battle.';
      const spans = matcher.match(text).map((match) => match.span);
      for (const [index, span] of spans.entries()) {
        const next = spans[index + 1];
        if (next) expect(span[1]).toBeLessThanOrEqual(next[0]);
      }
    });
  });

  describe('spelling the compendium varies', () => {
    it.each([
      ['Sleep', 'sleeping'],
      ['Sleeping', 'sleeping'],
      ['Stone', 'stoned'],
      ['Stoned', 'stoned'],
      ['Spell Gem', 'spell gems'],
      ['Spell Gems', 'spell gems'],
      ['manually cast', 'manual cast'],
      ['manually casts', 'manual cast'],
      ['start battles', 'start of battle'],
    ])('reads %s as %s', (written, key) => {
      expect(keysIn(`It ${written} here.`)).toEqual([key]);
    });

    it('reads a curly apostrophe as a straight one, without moving the spans', () => {
      const curly = 'At the start of this creature’s turn, it gains Shelled.';
      const straight = curly.replace('’', "'");
      expect(matcher.match(curly)).toEqual(matcher.match(straight));
      expect(keysIn(curly)).toEqual(['start of turn', 'shelled']);
    });

    it('reads any run of blanks inside a phrase as one space', () => {
      const text = "Your creatures' Spell   Gems and start\nof  battle.";
      expect(matcher.match(text).map(({ key, span }) => [key, text.slice(span[0], span[1])])).toEqual([
        ['spell gems', 'Spell   Gems'],
        ['start of battle', 'start\nof  battle'],
      ]);
    });
  });

  describe('several keywords', () => {
    it('finds them in the order they appear', () => {
      expect(
        keysIn('After an enemy is afflicted with either Weak or Vulnerable, this creature gains Barrier.'),
      ).toEqual(['weak', 'vulnerable', 'barrier']);
    });

    it('finds the same keyword each time it appears', () => {
      const text = 'Weak enemies with Weak allies.';
      expect(matcher.match(text).map((match) => match.span)).toEqual([
        [0, 4],
        [18, 22],
      ]);
    });

    it('finds the flag and the mechanics too', () => {
      expect(keysIn('Your spells gain 50% critical damage on the Timeline. This trait does not stack.')).toEqual([
        'spells',
        'critical damage',
        'timeline',
        'nostack',
      ]);
    });
  });

  describe('a taxonomy of its own', () => {
    it('finds only what the taxonomy knows', () => {
      const custom = createKeywordMatcher(
        createTaxonomy([{ kind: 'buff', key: 'glowing', label: 'Glowing', patterns: ['Glowing'] }]),
      );
      expect(custom.match('Glowing and Weak.').map((match) => match.key)).toEqual(['glowing']);
    });

    it('finds nothing with an empty taxonomy', () => {
      expect(createKeywordMatcher(createTaxonomy([])).match('Weak and Vulnerable.')).toEqual([]);
    });

    it('takes characters that mean something in patterns as plain text', () => {
      const custom = createKeywordMatcher(
        createTaxonomy([{ kind: 'mechanic', key: 'a+b (c)', label: 'A+B', patterns: ['a+b (c)'] }]),
      );
      expect(custom.match('See A+B (C) here; aab c').map((match) => match.span)).toEqual([[4, 11]]);
    });
  });
});
