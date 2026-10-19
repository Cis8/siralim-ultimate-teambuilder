import type { KeywordStats, KeywordVerdict } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { chipCounts, countsOf, liveSummary, otherSources, togetherWith, verdictLine } from './keyword-summary';

const stats = (overrides: Partial<KeywordStats> = {}): KeywordStats => ({
  appliers: 5,
  conditional: 0,
  random: 0,
  users: 3,
  ...overrides,
});

describe('the verdict of a keyword, in words', () => {
  const VERDICTS: readonly KeywordVerdict[] = [
    'supported',
    'scarce',
    'no-payoff',
    'only-random',
    'only-conditional',
    'no-source',
  ];

  it('has a title, a reason and a tone for each of the six verdicts, and no two share a title', () => {
    const lines = VERDICTS.map((verdict) => verdictLine(verdict, stats(), false));

    expect(lines.map(({ id }) => id)).toEqual(VERDICTS);
    for (const { title, detail } of lines) {
      expect(title).not.toBe('');
      expect(detail).toMatch(/\.$/u);
    }
    expect(new Set(lines.map(({ title }) => title)).size).toBe(VERDICTS.length);
  });

  it('calls only a keyword that is well supported good, and one that nothing gives bad: the rest ask for care', () => {
    const toneOf = (verdict: KeywordVerdict) => verdictLine(verdict, stats(), false).tone;

    expect(toneOf('supported')).toBe('good');
    expect(toneOf('no-source')).toBe('bad');
    for (const verdict of ['scarce', 'no-payoff', 'only-random', 'only-conditional'] as const) {
      expect(toneOf(verdict)).toBe('caution');
    }
  });

  it('says where nothing gives the keyword, in the words of the filter that may have left it so', () => {
    const none = (artifactOnly: boolean) => verdictLine('no-source', stats({ appliers: 0, users: 0 }), artifactOnly);

    expect(none(false).detail).toBe('No trait gives or relies on it in the compendium.');
    expect(none(true).detail).toBe('No trait gives or relies on it among artifact-eligible traits.');
  });

  it('adds what a keyword nobody gives costs the traits that rely on it', () => {
    const line = verdictLine('no-source', stats({ appliers: 0, users: 4 }), false);

    expect(line.detail).toBe('No trait gives it in the compendium, so the traits that rely on it cannot count on it.');
  });
});

describe('the counts of a keyword', () => {
  it('say how many apply it and how many rely on it, in the grammar of the number', () => {
    expect(countsOf(stats({ appliers: 8, users: 6 }))).toEqual({
      appliers: { number: '8', phrase: 'apply it' },
      users: { number: '6', phrase: 'rely on it' },
    });
    expect(countsOf(stats({ appliers: 1, users: 1 }))).toEqual({
      appliers: { number: '1', phrase: 'applies it' },
      users: { number: '1', phrase: 'relies on it' },
    });
    expect(countsOf(stats({ appliers: 0, users: 0 }))).toEqual({
      appliers: { number: '0', phrase: 'apply it' },
      users: { number: '0', phrase: 'rely on it' },
    });
  });

  it('are spoken on a chip as appliers and users, not as arrows', () => {
    expect(chipCounts(stats({ appliers: 14, users: 26 }))).toBe('14 appliers, 26 users');
    expect(chipCounts(stats({ appliers: 1, users: 1 }))).toBe('1 applier, 1 user');
    expect(chipCounts(stats({ appliers: 6, users: 0 }))).toBe('6 appliers, 0 users');
  });

  it('keep the traits that give a keyword by chance or under a condition apart from those that apply it', () => {
    expect(otherSources(stats())).toBeUndefined();
    expect(otherSources(stats({ random: 27 }))).toBe('27 more afflict a random debuff, which may be this one.');
    expect(otherSources(stats({ random: 1 }))).toBe('1 more afflicts a random debuff, which may be this one.');
    expect(otherSources(stats({ conditional: 1 }))).toBe('1 more gives it once another debuff is there.');
    expect(otherSources(stats({ conditional: 2, random: 26 }))).toBe(
      '2 more give it once another debuff is there. 26 more afflict a random debuff, which may be this one.',
    );
  });
});

describe('what a screen reader is told about a keyword', () => {
  const line = verdictLine('supported', stats({ appliers: 8, users: 6 }), false);

  it('is the keyword, its counts and its verdict with the reason', () => {
    expect(liveSummary('Vulnerable', stats({ appliers: 8, users: 6 }), line)).toBe(
      'Vulnerable: 8 apply it, 6 rely on it. Well supported. Enough traits apply it for the ones that rely on it.',
    );
  });

  it('says one trait in the singular', () => {
    expect(liveSummary('Immune', stats({ appliers: 1, users: 0 }), verdictLine('no-payoff', stats(), false))).toMatch(
      /^Immune: 1 applies it, 0 rely on it\. No payoff yet\./u,
    );
  });
});

describe('the keywords its appliers also apply', () => {
  it('are links to their pages, named and coloured by kind, in the order the view ranks them', () => {
    const found = togetherWith(
      [
        { key: 'vulnerable', count: 4 },
        { key: 'barrier', count: 2 },
        { key: 'mega magic', count: 1 },
      ],
      (key) => `/kw/${key}`,
    );

    expect(found).toEqual([
      { key: 'vulnerable', label: 'Vulnerable', kind: 'debuff', count: 4, href: '/kw/vulnerable' },
      { key: 'barrier', label: 'Barrier', kind: 'buff', count: 2, href: '/kw/barrier' },
      { key: 'mega magic', label: 'Mega Magic', kind: 'effect', count: 1, href: '/kw/mega magic' },
    ]);
  });

  it('leave out a key that is no buff, debuff or effect, which has no page', () => {
    expect(togetherWith([{ key: 'attack', count: 3 }], () => '/x')).toEqual([]);
    expect(togetherWith([], () => '/x')).toEqual([]);
  });
});
