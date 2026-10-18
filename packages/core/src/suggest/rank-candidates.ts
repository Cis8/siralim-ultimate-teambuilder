import { MATCH_TIERS } from './match-tier';
import type { Candidate } from './suggestion';

/** The most that is listed (QUERY_LANGUAGE §6): more is more than a list on a phone, or a person, reads. */
export const MAX_SUGGESTIONS = 9;

/**
 * The candidates in the order they are listed: by how well they fit what was typed (prefix, word start, substring, then
 * what fits whatever was typed), and inside a tier in the order the providers gave them. A text is listed once, whatever its
 * letter case, at the best place it was offered at, and at most `MAX_SUGGESTIONS` are kept: the cut is made after the
 * ranking, so that a good fit that came late is not lost to a poor one that came early.
 */
export function rankCandidates(candidates: readonly Candidate[]): Candidate[] {
  const listed = new Map<string, Candidate>();
  for (const tier of MATCH_TIERS) {
    for (const candidate of candidates) {
      if (candidate.tier !== tier) continue;
      const text = candidate.insert.toLowerCase();
      if (!listed.has(text)) listed.set(text, candidate);
      if (listed.size === MAX_SUGGESTIONS) return [...listed.values()];
    }
  }
  return [...listed.values()];
}
