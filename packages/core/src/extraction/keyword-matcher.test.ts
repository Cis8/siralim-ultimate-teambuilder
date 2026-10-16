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
      expect(keysIn(`${written}, it attacks.`)).toEqual(['start of battle']);
    });

    it('is ignored in a mechanic: "spell gems" and "Spell Gems"', () => {
      expect(keysIn('Seal spell gems. Seal Spell Gems.')).toEqual(['spell gems', 'spell gems']);
    });

    it('matters for a buff or debuff, which is a name: only the written form counts', () => {
      expect(keysIn('Enemies with Weak attack.')).toEqual(['weak']);
      expect(keysIn('Enemies with weak attack.')).toEqual([]);
      expect(keysIn('Enemies with WEAK attack.')).toEqual([]);
    });

    it.each([
      ['are immune to Silenced', ['silenced']],
      ['are immune to damage from spells', []],
      ['gain Immune', ['immune']],
      ['creatures that are weak against their class', []],
    ])('keeps an adjective from being a status: "%s"', (text, keys) => {
      expect(keysIn(`Your creatures ${text}.`)).toEqual(keys);
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
      expect(keysIn(`Your ${word} attack.`)).not.toContain(key);
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
    it('reads "start of battle" and "start of this creature\'s turn" as different triggers', () => {
      expect(keysIn("At the start of battle and at the start of this creature's turn, it attacks.")).toEqual([
        'start of battle',
        "start of this creature's turn",
      ]);
    });

    it('reads Sleeping as one keyword, not Sleep followed by "ing"', () => {
      expect(matcher.match('Your creatures with Sleeping attack.')).toEqual([
        { key: 'sleeping', kind: 'debuff', span: [20, 28] },
      ]);
    });

    it('prefers the longer phrase when one contains the other', () => {
      const overlapping = createKeywordMatcher(
        createTaxonomy([
          { kind: 'mechanic', key: 'spell', label: 'Spell', patterns: ['spell'] },
          { kind: 'mechanic', key: 'spell gems', label: 'Spell Gems', patterns: ['spell gems'] },
        ]),
      );
      expect(overlapping.match('Seal spell gems and a spell.').map((match) => match.key)).toEqual([
        'spell gems',
        'spell',
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
      ['manually cast a spell', 'manually cast a spell'],
      ['manually casts a spell', 'manually cast a spell'],
      ['start battles', 'start of battle'],
    ])('reads %s as %s', (written, key) => {
      expect(keysIn(`It ${written} here.`)).toEqual([key]);
    });

    it('reads a curly apostrophe as a straight one, without moving the spans', () => {
      const curly = 'At the start of this creature’s turn, it gains Shelled.';
      const straight = curly.replace('’', "'");
      expect(matcher.match(curly)).toEqual(matcher.match(straight));
      expect(keysIn(curly)).toEqual(["start of this creature's turn", 'shelled']);
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
      expect(keysIn('Your spells always deal critical damage to the Timeline. This trait does not stack.')).toEqual([
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
