import type { KeywordActor, KeywordRole } from '../model/trait';
import type { KeywordMatch } from './keyword-matcher';
import { sentenceStart } from './sentences';

/**
 * What a trait does with a keyword that has a role and, for an event, who does it or has it done to them (GAME_RULES R12).
 * The reading of a buff, a debuff or an effect is its role alone.
 */
export interface EventReading {
  readonly role: KeywordRole;
  /** Absent where the text names nobody. */
  readonly actor?: KeywordActor;
}

/**
 * Reads an event mention from the words around it, by wording; corrected where it is wrong by `overrides.yaml`.
 *
 * - **Role.** The trait pays off when the event happens (`uses`) when the mention is in a condition: the one the sentence
 *   opens with ("After this creature attacks, …"), one a later clause sets ("for each spell cast", "while it defends", "at the
 *   end of", "enemies that die"), or a noun: the creature's own ("this creature's attacks deal 75% more damage"), the object
 *   of a preposition ("damage from attacks") or a quantity ("100% more healing"). It prevents the event (`resists`) after
 *   "cannot", "immune to", "never" or "can only". Otherwise the trait makes it happen (`applies`): a verb of the main
 *   clause ("attacks 1 additional time", "casts a random spell", "is resurrected").
 * - **Lists.** The reading says whether it can be carried over to the events listed after it (`listable`): a prevention or a
 *   condition can ("cannot attack, cast or defend"), a noun cannot ("dodge attacks and deal critical damage").
 * - **Actor.** The nearest subject before the event in its clause, or in its sentence when the clause has none; for a spell
 *   that was cast (not by a subject of the clause) the one after "by", or any creature. For the turns the words name an
 *   owner themselves (`match.actor`), which wins. None when the text names nobody.
 */
export function readEvent(text: string, match: KeywordMatch): EventReading & { readonly listable: boolean } {
  const start = match.span[0];
  const actor = match.actor ?? passiveActor(text, match) ?? possessorAfter(text, match) ?? actorBefore(text, start);
  const { role, nominal } = roleOf(text, start);
  return { role, listable: !nominal, ...(actor === undefined ? {} : { actor }) };
}

// --- Role ---------------------------------------------------------------------------------------------------------

/** The sentence opens with a condition: what its first clause names is waited for. */
const CONDITION_OPENER =
  /^(?:after|when|whenever|if|while|at|each time|every time|the first(?: \d+)? times?|once|before|upon|as long as|until|for each)\b/i;

/** Words that make what follows, up to the next comma, a condition. */
const CONDITION_WORD =
  /\b(?:for each|for every|while|if|as long as|when|whenever|after|each time|every time|number of times|between|until|before|the first time)\b/i;

/** "that die", "targets that are defending", "the spell that any creature cast": a relative clause describes, not does. */
const RELATIVE_CLAUSE =
  /\b(?:that(?! (?:enemy|creature|ally|spell|damage|target|trait|effect|amount|buff|debuff)\b)|who)\b[^,.;]*$/i;

/** The prevention reaches as far as the clause goes, and no further than the next thing it says ("and have …"). */
const PREVENTION =
  /\b(?:cannot|can't|can not|immune to|never|can only(?! (?:activate|work|trigger|occur)))\b(?:(?!\bbut\b|\band (?:have|has|can|are|is|gain|gains|deal|deals)\b)[^,.;])*$/i;

/** The creature's own, as a noun: "this creature's attacks", "their on-attack effects". */
const POSSESSIVE_BEFORE = /(?:'s|s'|\b(?:their|its|your))\s+$/i;

/** "at the start of", "until the end of", "for each buff": a point in the battle or a count, mid-sentence. */
const POINT_OR_COUNT_BEFORE = /\b(?:at|until|during|for)\s+(?:the\s+)?$/i;

/** "100% more healing", "the amount healed": what is counted, not what is done. */
const QUANTITY_BEFORE = /(?:\d%|\b(?:more|less|fewer|greater)|\bamount(?: of \w+)?)\s+$/i;

/** The object of a preposition, an article or a verb that takes the event itself: "damage from attacks", "dodge attacks". */
const NOUN_BEFORE =
  /\b(?:with|from|by|against|of|through|after|upon|an?|the|each|every|these|those|this|first|extra|additional|consecutive|original|subsequent|dodges?|dodged|dodging|intercepts?|avoids?|redirects?|negates?|prevents?|ignores?)\s+$/i;

/** `nominal`: the mention is a noun that something is said about, which says nothing of the events listed after it. */
function roleOf(text: string, start: number): { readonly role: KeywordRole; readonly nominal: boolean } {
  const from = sentenceStart(text, start);
  const sentence = text.slice(from);
  if (CONDITION_OPENER.test(sentence) && start - from < openingConditionEnd(sentence)) {
    return { role: 'uses', nominal: false };
  }

  const before = text.slice(from, start);
  if (POINT_OR_COUNT_BEFORE.test(before)) return { role: 'uses', nominal: false };
  if (POSSESSIVE_BEFORE.test(before) || NOUN_BEFORE.test(before) || QUANTITY_BEFORE.test(before)) {
    return { role: 'uses', nominal: true };
  }

  const clause = before.slice(before.lastIndexOf(',') + 1);
  if (PREVENTION.test(clause)) return { role: 'resists', nominal: false };
  if (CONDITION_WORD.test(clause) || RELATIVE_CLAUSE.test(clause)) return { role: 'uses', nominal: false };
  return { role: 'applies', nominal: false };
}

/** Where the condition a sentence opens with ends: at the first comma that is not followed by "or" or "and". */
function openingConditionEnd(sentence: string): number {
  for (const comma of sentence.matchAll(/,/g)) {
    if (!/^\s*(?:or|and)\b/i.test(sentence.slice(comma.index + 1))) return comma.index;
  }
  return sentence.length;
}

// --- Actor --------------------------------------------------------------------------------------------------------

/** The number of what a subject names; a pronoun ("it", "they") stands for the first subject of its number. */
type Plurality = 'singular' | 'plural';

interface Subject {
  readonly actor: KeywordActor;
  readonly number: Plurality;
  readonly pronoun?: true;
  readonly pattern: RegExp;
}

/** Who a clause is about, by the words it uses for them. Case-insensitive unless a family's capital says otherwise. */
const SUBJECTS: readonly Subject[] = [
  { actor: 'self', number: 'singular', pattern: /\bthis creature\b/gi },
  { actor: 'self', number: 'singular', pronoun: true, pattern: /\b(?:it|its|itself)\b/gi },
  {
    actor: 'ally',
    number: 'plural',
    pattern:
      /\b(?:your(?: other)?(?: creatures)?|one of your (?:other )?creatures|creatures in your party|allies|each ally)\b/gi,
  },
  {
    actor: 'ally',
    number: 'singular',
    pattern: /\b(?:an? (?:adjacent )?ally|another creature in your party|your creature)\b/gi,
  },
  { actor: 'ally', number: 'plural', pronoun: true, pattern: /\b(?:they|them|their)\b/gi },
  // "your Efts", "Your Griffons creatures": a family, the only thing capitalised after "your".
  { actor: 'ally', number: 'plural', pattern: /\b[Yy]our (?:other )?[A-Z][a-z]+(?: creatures?)?/g },
  {
    actor: 'enemy',
    number: 'singular',
    pattern: /\b(?:an enemy|the enemy|enemy|(?:the )?target|opponent)\b(?: creature\b)?/gi,
  },
  {
    actor: 'enemy',
    number: 'plural',
    pattern: /\b(?:enemy creatures|enemies'?|each enemy|(?:the )?targets|opponents)\b/gi,
  },
  { actor: 'any', number: 'singular', pattern: /\b(?:an?|each|every|any)(?: adjacent)? creature\b/gi },
  { actor: 'any', number: 'plural', pattern: /(?:\b(?:all(?: other)?|other|adjacent) )?\bcreatures\b/gi },
];

/** "Your creatures adjacent to this creature attack": the second creature only says where the first one stands. */
const WHERE_IT_STANDS = /\b(?:adjacent|next) to (?:this creature|it|them)\b/gi;

function actorBefore(text: string, start: number): KeywordActor | undefined {
  const sentence = sentenceStart(text, start);
  const clause = Math.max(sentence, lastClauseBreak(text, start) + 1);
  const named = nearestSubject(text.slice(clause, start)) ?? nearestSubject(text.slice(sentence, start));
  return named === undefined ? undefined : actorOf(named, text.slice(sentence, start));
}

/** A pronoun stands for the first subject of its number that the sentence named, as "After an enemy dies, it …" says. */
function actorOf(subject: Named, earlier: string): KeywordActor {
  if (subject.pronoun !== true) return subject.actor;
  // "After an enemy dodges, they take damage": the same number if there is one, otherwise whoever was named first.
  const named = subjectsIn(earlier).filter((each) => each.pronoun !== true);
  const antecedent = named.find((each) => each.number === subject.number) ?? named[0];
  return (antecedent ?? subject).actor;
}

const lastClauseBreak = (text: string, position: number) =>
  Math.max(
    text.lastIndexOf(',', position - 1),
    text.lastIndexOf(';', position - 1),
    text.lastIndexOf('.', position - 1),
  );

interface Named extends Pick<Subject, 'actor' | 'number' | 'pronoun'> {
  readonly start: number;
  readonly end: number;
}

/** The subjects of a text in order, ignoring one inside another ("creatures" in "your creatures"). */
function subjectsIn(words: string): Named[] {
  const bare = words.replace(WHERE_IT_STANDS, (standing) => ' '.repeat(standing.length));
  const found: Named[] = SUBJECTS.flatMap(({ actor, number, pronoun, pattern }) =>
    [...bare.matchAll(pattern)].map((subject) => ({
      actor,
      number,
      ...(pronoun === undefined ? {} : { pronoun }),
      start: subject.index,
      end: subject.index + subject[0].length,
    })),
  );
  return found
    .filter(
      (inner) =>
        !found.some(
          (outer) =>
            outer.start <= inner.start && inner.end <= outer.end && outer.end - outer.start > inner.end - inner.start,
        ),
    )
    .toSorted((a, b) => a.start - b.start);
}

/** The subject that ends last. */
function nearestSubject(words: string): Named | undefined {
  return subjectsIn(words).toSorted((a, b) => b.end - a.end || a.start - b.start)[0];
}

/** "for each buff the enemy has": what is counted belongs to who is named right after. */
function possessorAfter(text: string, match: KeywordMatch): KeywordActor | undefined {
  const [start, end] = match.span;
  if (!/\bfor\s+$/i.test(text.slice(Math.max(0, start - 8), start))) return undefined;
  return subjectAtStart(text.slice(end + 1, end + 31), text.slice(sentenceStart(text, start), start));
}

/** The subject a text begins with, if it does; `earlier` is what the sentence said before, for a pronoun to look into. */
function subjectAtStart(words: string, earlier: string): KeywordActor | undefined {
  const first = subjectsIn(words)[0];
  return first?.start === 0 ? actorOf(first, earlier) : undefined;
}

/** "the spell that has been cast", "the last spell cast": the spell is the subject of the verb, not the creature. */
const SPELL_THAT_WAS_BEFORE = /\b(?:spells?\s+(?:that\s+)?(?:(?:has|have)\s+been|is|are|was|were)|last\s+spells?)\s+$/i;

/** Whoever cast it is after "by", or nobody in particular. */
function passiveActor(text: string, match: KeywordMatch): KeywordActor | undefined {
  const [start, end] = match.span;
  if (!SPELL_THAT_WAS_BEFORE.test(text.slice(Math.max(0, start - 40), start))) return undefined;
  const by = /^\s+by\s+/i.exec(text.slice(end, end + 40));
  if (by === null) return 'any';
  const agent = text.slice(end + by[0].length, end + by[0].length + 30);
  return subjectAtStart(agent, text.slice(sentenceStart(text, start), start)) ?? 'any';
}
