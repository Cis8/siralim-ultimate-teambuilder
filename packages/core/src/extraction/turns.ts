import type { KeywordActor } from '../model/trait';

/** The beginning or the end of somebody's turn, as the text says it. */
export interface TurnMention {
  readonly edge: 'start' | 'end';
  /** Half-open character range `[start, end)` in the text that was searched. */
  readonly span: readonly [start: number, end: number];
  /** Who the owner of the turn is, when the words name one: "its", "your Phoenixes'", "each enemy's". */
  readonly actor?: KeywordActor;
}

// The owner of a turn is a possessive: a creature's, a family's ("your Phoenixes'"), a status's ("each Cursed enemy's"). No
// list of phrases can spell them all, hence a grammar:  start|end [and start|end] of <owner> [ordinal] turn(s)
const POSSESSIVE = String.raw`(?:[a-z][a-z-]* ){0,3}[a-z][a-z-]*(?:'s|s'|')|its|their`;
const OWNER = String.raw`(?:(?:each|every) of )?(?:${POSSESSIVE})|each|every`;
const TURN = new RegExp(
  String.raw`(?<![\p{L}\p{N}-])(start|end)(?: and (start|end))? of (?:(${OWNER})(?: (?:first|second|third|next))? )?turns?(?![\p{L}\p{N}])`,
  'giu',
);

// "its turn ends": the end of a turn said as a sentence. The owner starts with a determiner, so that the words before it
// ("then", "and") are not taken for part of it.
const TURN_ENDS = new RegExp(
  String.raw`(?<![\p{L}\p{N}-])(its|their|this creature's|(?:your|each|the|an) (?:[a-z][a-z-]* ){0,2}[a-z][a-z-]*(?:'s|s'|')) turns? ends?(?![\p{L}\p{N}])`,
  'giu',
);

/**
 * The starts and ends of turns in a text, in order. "At the start and end of their turn" is two mentions: the first
 * covers "start and" and the second "end of their turn", so that no span overlaps another.
 */
export function findTurns(text: string): TurnMention[] {
  const ends = [...text.matchAll(TURN_ENDS)].map((found): TurnMention => {
    const actor = actorOfOwner(found[1]);
    return {
      edge: 'end',
      span: [found.index, found.index + found[0].length],
      ...(actor === undefined ? {} : { actor }),
    };
  });
  const edges = findEdges(text);
  return [...edges, ...ends].toSorted((a, b) => a.span[0] - b.span[0]);
}

function findEdges(text: string): TurnMention[] {
  return [...text.matchAll(TURN)].flatMap((found) => {
    const [whole, first = '', second, owner] = found;
    const actor = actorOfOwner(owner);
    const withActor = actor === undefined ? {} : { actor };
    const begin = found.index;
    if (second === undefined) {
      return [{ edge: edgeOf(first), span: [begin, begin + whole.length] as const, ...withActor }];
    }
    // "start and end of …": the words up to "and" belong to the first edge, the rest to the second.
    const andEnd = begin + first.length + ' and'.length;
    const secondBegin = andEnd + 1;
    return [
      { edge: edgeOf(first), span: [begin, andEnd] as const, ...withActor },
      { edge: edgeOf(second), span: [secondBegin, begin + whole.length] as const, ...withActor },
    ];
  });
}

const edgeOf = (word: string): 'start' | 'end' => (word.toLowerCase() === 'start' ? 'start' : 'end');

/** "their" names nobody: the creatures it stands for are in the sentence around it. */
function actorOfOwner(owner: string | undefined): KeywordActor | undefined {
  if (owner === undefined) return undefined;
  const words = owner.toLowerCase();
  if (/\benem/.test(words)) return 'enemy';
  if (/\b(?:your|ally|allies)\b/.test(words)) return 'ally';
  if (/\b(?:this creature|its)\b/.test(words)) return 'self';
  if (/\b(?:each|every)\b/.test(words)) return 'any';
  return undefined;
}
