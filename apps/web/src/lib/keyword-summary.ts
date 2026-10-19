import { taxonomy, type CoApplied, type KeywordKey, type KeywordStats, type KeywordVerdict } from '@atlas/core';
import { copy } from './copy';
import { keyLabel } from './key-label';

/** How a verdict is drawn: an icon and a colour for each, and the words say the rest (DESIGN § Colour rules). */
export type VerdictTone = 'good' | 'caution' | 'bad';

/** The verdict of a keyword as the summary says it. */
export interface VerdictLine {
  readonly id: KeywordVerdict;
  readonly tone: VerdictTone;
  readonly title: string;
  /** One sentence, with its full stop: why the keyword has this verdict. */
  readonly detail: string;
}

const TONES: Readonly<Record<KeywordVerdict, VerdictTone>> = {
  supported: 'good',
  scarce: 'caution',
  'no-payoff': 'caution',
  'only-random': 'caution',
  'only-conditional': 'caution',
  'no-source': 'bad',
};

/** The words for a verdict. The counts and the filter matter only where nothing gives the keyword: it says what that costs. */
export function verdictLine(verdict: KeywordVerdict, { users }: KeywordStats, artifactOnly: boolean): VerdictLine {
  if (verdict === 'no-source') {
    return {
      id: verdict,
      tone: TONES[verdict],
      title: copy.verdicts['no-source'].title,
      detail: copy.noSourceDetail(users > 0, artifactOnly),
    };
  }
  return { id: verdict, tone: TONES[verdict], ...copy.verdicts[verdict] };
}

/** A number and the words that follow it ("8" and "apply it"): the summary puts the number in bold. */
export interface CountPhrase {
  readonly number: string;
  readonly phrase: string;
}

/** The two counts of the summary, "8 apply it · 6 rely on it". Only the traits that apply it by name count (PLAN D29). */
export function countsOf({ appliers, users }: KeywordStats): { appliers: CountPhrase; users: CountPhrase } {
  return {
    appliers: { number: String(appliers), phrase: copy.countPhrases.appliers(appliers) },
    users: { number: String(users), phrase: copy.countPhrases.users(users) },
  };
}

/** What a chip says to the ear instead of its arrows: "8 appliers, 6 users". */
export const chipCounts = ({ appliers, users }: KeywordStats): string => copy.chipCounts(appliers, users);

/** The traits that give the keyword only under a condition or by chance, in a sentence; nothing when there are none. */
export function otherSources({ conditional, random }: KeywordStats): string | undefined {
  const sentences = [
    ...(conditional > 0 ? [copy.conditionalOthers(conditional)] : []),
    ...(random > 0 ? [copy.randomOthers(random)] : []),
  ];
  return sentences.length === 0 ? undefined : sentences.join(' ');
}

/** The line a screen reader is told when the page moves to another keyword: its counts, its verdict and the reason. */
export function liveSummary(label: string, stats: KeywordStats, { title, detail }: VerdictLine): string {
  const { appliers, users } = countsOf(stats);
  return `${label}: ${appliers.number} ${appliers.phrase}, ${users.number} ${users.phrase}. ${title}. ${detail}`;
}

/** A keyword that the appliers of this one also apply, and how many of them do: a link to its page. */
export interface TogetherEntry<Href = string> {
  readonly key: KeywordKey;
  readonly label: string;
  readonly kind: 'debuff' | 'buff' | 'effect';
  readonly count: number;
  readonly href: Href;
}

/** The keywords the appliers also apply, as the summary links them, the most shared first as the view ranks them. */
export function togetherWith<Href>(
  coApplied: readonly CoApplied[],
  hrefOf: (key: KeywordKey) => Href,
): TogetherEntry<Href>[] {
  return coApplied.flatMap(({ key, count }) => {
    const kind = taxonomy.get(key)?.kind;
    // The view lists buffs, debuffs and effects only; a key of another kind would have no page to link to.
    if (kind !== 'debuff' && kind !== 'buff' && kind !== 'effect') return [];
    return [{ key, label: keyLabel(key), kind, count, href: hrefOf(key) }];
  });
}
