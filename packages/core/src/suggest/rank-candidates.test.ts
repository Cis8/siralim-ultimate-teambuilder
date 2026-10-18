import { describe, expect, it } from 'vitest';
import type { MatchTier } from './match-tier';
import { MAX_SUGGESTIONS, rankCandidates } from './rank-candidates';
import type { Candidate } from './suggestion';

const candidate = (insert: string, tier: MatchTier = 'prefix'): Candidate => ({
  kind: 'field',
  insert,
  detail: `about ${insert}`,
  complete: false,
  tier,
});

const inserts = (candidates: readonly Candidate[]): string[] => rankCandidates(candidates).map(({ insert }) => insert);

describe('rankCandidates', () => {
  it('lists the prefix fits first, then the word starts, then the substrings, then the fallback (QUERY_LANGUAGE §6)', () => {
    expect(
      inserts([
        candidate('fallback', 'fallback'),
        candidate('substring', 'substring'),
        candidate('word start', 'word-start'),
        candidate('prefix'),
      ]),
    ).toEqual(['prefix', 'word start', 'substring', 'fallback']);
  });

  it('keeps the order the providers gave inside a tier: the ranking is stable', () => {
    expect(
      inserts([
        candidate('b'),
        candidate('x', 'substring'),
        candidate('a'),
        candidate('z', 'word-start'),
        candidate('c'),
        candidate('y', 'substring'),
        candidate('w', 'word-start'),
      ]),
    ).toEqual(['b', 'a', 'c', 'z', 'w', 'x', 'y']);
  });

  it('gives the candidates as they were offered', () => {
    const [first] = rankCandidates([candidate('class:')]);

    expect(first).toEqual({ kind: 'field', insert: 'class:', detail: 'about class:', complete: false, tier: 'prefix' });
  });

  it('lists a text once, whatever its letter case, at the best place it was offered at', () => {
    expect(
      inserts([
        candidate('uses:weak', 'substring'),
        candidate('applies:weak', 'word-start'),
        candidate('USES:Weak'),
        candidate('applies:weak', 'substring'),
      ]),
    ).toEqual(['USES:Weak', 'applies:weak']);
  });

  it('lists at most 9, and counts the repeats as no candidate', () => {
    const many = Array.from({ length: 20 }, (_, at) => candidate(`field${at}:`));
    const withRepeats = many.flatMap((each) => [each, each]);

    expect(MAX_SUGGESTIONS).toBe(9);
    expect(inserts(many)).toEqual(many.slice(0, 9).map(({ insert }) => insert));
    expect(inserts(withRepeats)).toEqual(many.slice(0, 9).map(({ insert }) => insert));
  });

  it('cuts after ranking: a better fit that came late beats an earlier one', () => {
    const early = Array.from({ length: 12 }, (_, at) => candidate(`sub${at}`, 'substring'));

    expect(inserts([...early, candidate('late prefix')])[0]).toBe('late prefix');
    expect(inserts([...early, candidate('late prefix')])).toHaveLength(9);
  });

  it('lists nothing for nothing', () => {
    expect(rankCandidates([])).toEqual([]);
  });
});
