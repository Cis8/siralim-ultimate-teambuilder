// "Attack" is both what a creature does and one of its stats ("50% more attack"). The word alone cannot tell, the words
// around it can: a stat is owned, counted, added, compared or listed with other stats; an action is not.
const OWNED_OR_COUNTED_BEFORE =
  /(?:%|'s|s'|\b(?:more|less|fewer|highest|lowest|total|base|than|its|their|his|her|gains?|gained|loses?|lost|of))\s+$/i;
const STAT_NAME = String.raw`(?:attack|defense|intelligence|speed|health|maximum health)\b`;
const LISTED_OR_COMPARED_AFTER = new RegExp(
  String.raw`^(?:\s*(?:,|and|or)\s*${STAT_NAME}|\s+(?:is|are) (?:added|set|lower|higher|equal)|\s+(?:equal to|bonus|stats?|as well|instead|increases?|by \d))`,
  'i',
);

/**
 * Whether the word at `[start, end)` of the text is the stat and not the action. Only the immediate surroundings are
 * read, as far back and forward as a phrase goes.
 */
export function isStatSense(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 16), start);
  const after = text.slice(end, end + 24);
  return OWNED_OR_COUNTED_BEFORE.test(before) || LISTED_OR_COMPARED_AFTER.test(after);
}
