import type { KeywordHit, KeywordKind, KeywordRole } from '../model/trait';
import type { KeywordMatch } from './keyword-matcher';

/**
 * What the trait does with each buff and debuff it names: gives it (`applies`), relies on it being there (`uses`) or
 * only guards against it (`resists`, GAME_RULES R9). A first reading by wording, corrected where it is wrong by
 * `overrides.yaml`. Keywords that are not buffs or debuffs get no role.
 *
 * - A status in the condition a sentence opens with ("After an enemy is afflicted with Weak, …") is one the trait
 *   waits for: `uses`.
 * - Otherwise the nearest signal before it in the sentence decides (see `CUES`); with none, `uses`.
 * - A status that follows another in a list ("Poisoned, Burning and Bomb", "Weak or Vulnerable") takes its role.
 */
export function assignRoles(text: string, matches: readonly KeywordMatch[]): KeywordHit[] {
  const hits: KeywordHit[] = [];
  let previous: { readonly match: KeywordMatch; readonly role: KeywordRole } | undefined;

  for (const match of matches) {
    if (!isStatus(match.kind)) {
      hits.push({ key: match.key, kind: match.kind, span: match.span });
      continue;
    }
    const role =
      previous !== undefined && continuesList(text, previous.match, match)
        ? previous.role
        : detectRole(text, match.span[0]);
    hits.push({ key: match.key, kind: match.kind, span: match.span, role });
    previous = { match, role };
  }
  return hits;
}

const isStatus = (kind: KeywordKind) => kind === 'buff' || kind === 'debuff';

interface Cue {
  readonly role: KeywordRole;
  readonly pattern: RegExp;
}

/**
 * Words that say what the trait does with the status that follows. Where two signals end at the same place, the one
 * that starts first is the more specific and wins: "afflicts enemies with" over "enemies with", "always has" over
 * "has", "if the enemy is afflicted with" over "afflicted with", "cannot gain" over "gain".
 */
const CUES: readonly Cue[] = [
  { role: 'applies', pattern: /\bafflict(?:s|ed)?\b[^,.;]*?\bwith\b/gi },
  { role: 'applies', pattern: /\bafflict(?:s|ed)?\b/gi },
  { role: 'applies', pattern: /\bgain(?:s|ed)?\b/gi },
  { role: 'applies', pattern: /\b(?:grants?|gives?)\b/gi },
  { role: 'applies', pattern: /\b(?:is|are) always\b/gi },
  { role: 'applies', pattern: /\balways (?:has|have)\b/gi },
  { role: 'applies', pattern: /\bbattles? with\b/gi },
  { role: 'uses', pattern: /\b(?:has|have|had)\b/gi },
  { role: 'uses', pattern: /\bdamage from\b/gi },
  { role: 'resists', pattern: /\b(?:immune|resistant) to\b/gi },
  { role: 'resists', pattern: /\bavoid\b/gi },
  { role: 'resists', pattern: /\btakes? (?:\d+% )?less damage from\b/gi },
  { role: 'resists', pattern: /\bno longer takes? damage from\b/gi },
  { role: 'resists', pattern: /\b(?:cannot|can't) be(?: afflicted with)?\b/gi },
  { role: 'uses', pattern: /\b(?:cannot|can't) be (?:immune|resistant) to\b/gi },
  { role: 'uses', pattern: /\b(?:enem(?:y|ies)|creatures?) with\b/gi },
  { role: 'uses', pattern: /\b(?:enem(?:y|ies)|creatures?|allies|ally|team|targets?) afflicted with\b/gi },
  { role: 'uses', pattern: /\bfor each\b[^,.;]*?\bafflicted with\b/gi },
  { role: 'uses', pattern: /\b(?:if|while|when|whenever|as long as|unless)\b[^,.;]*?\bafflicted with\b/gi },
  { role: 'uses', pattern: /\b(?:cannot|can't|never)\s+(?:gain|be afflicted with|have)\b/gi },
];

/** The sentence starts with a condition: what it names is waited for, not given. */
const CONDITION_OPENER =
  /^(?:after|when|whenever|if|while|each time|every time|the first time|before|once|as long as|unless)\b/i;

function detectRole(text: string, statusStart: number): KeywordRole {
  const before = text.slice(sentenceStart(text, statusStart), statusStart);
  if (CONDITION_OPENER.test(before) && !before.includes(',')) return 'uses';

  let nearest: { role: KeywordRole; start: number; end: number } | undefined;
  for (const { role, pattern } of CUES) {
    for (const found of before.matchAll(pattern)) {
      const cue = { role, start: found.index, end: found.index + found[0].length };
      if (nearest === undefined || cue.end > nearest.end || (cue.end === nearest.end && cue.start < nearest.start)) {
        nearest = cue;
      }
    }
  }
  return nearest?.role ?? 'uses';
}

/** Where the sentence that contains `position` begins: after the last full stop, "!" or "?" followed by a blank. */
function sentenceStart(text: string, position: number): number {
  const boundary = /[.!?]\s+/g;
  let start = 0;
  for (const found of text.slice(0, position).matchAll(boundary)) start = found.index + found[0].length;
  return start;
}

const LIST_SEPARATOR = /^\s*(?:,|,?\s*(?:and|or|and\/or))?\s*$/i;

/** Only "and", "or" or a comma between two statuses: they are one list. */
function continuesList(text: string, previous: KeywordMatch, next: KeywordMatch): boolean {
  return LIST_SEPARATOR.test(text.slice(previous.span[1], next.span[0]));
}
