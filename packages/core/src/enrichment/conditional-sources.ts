import type { KeywordHit, KeywordKey } from '../model/trait';

const PICK_ONE_OF_THESE = /\bwhichever of these (?:debuffs|buffs)\b/i;

/**
 * The buffs and debuffs a trait applies only as "whichever of these the target doesn't already have" (GAME_RULES R10):
 * the statuses named in the sentence that says so. The trait names them as the condition that triggers it, so they read
 * as `uses`; this keeps the fact that it is also a conditional source of each.
 */
export function detectConditionalSources(description: string, keywords: readonly KeywordHit[]): KeywordKey[] {
  const keys = new Set<KeywordKey>();
  for (const [start, end] of sentenceRanges(description)) {
    if (!PICK_ONE_OF_THESE.test(description.slice(start, end))) continue;
    for (const hit of keywords) {
      if (hit.role !== undefined && hit.span[0] >= start && hit.span[1] <= end) keys.add(hit.key);
    }
  }
  return [...keys];
}

/** Half-open ranges of the sentences of a text: each ends at a full stop, "!" or "?" followed by a blank, or at the end. */
function sentenceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let start = 0;
  for (const boundary of text.matchAll(/[.!?]\s+/g)) {
    ranges.push([start, boundary.index + 1]);
    start = boundary.index + boundary[0].length;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges;
}
