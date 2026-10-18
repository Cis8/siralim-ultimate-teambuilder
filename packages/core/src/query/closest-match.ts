// The two rows of the table, kept between calls: a vocabulary is thousands of candidates, and allocating a row per candidate
// was most of the time of a "did you mean". Nothing in `editDistance` calls out, so a call never meets another's rows.
const scratchRows: [number[], number[]] = [[], []];

/**
 * How many single-letter edits (a letter added, removed or changed) turn one text into the other. Counts UTF-16 units.
 *
 * With a `limit` it stops as soon as no row can end within it, and then gives something above the limit instead of the
 * distance: all a "did you mean" wants to know about a candidate that is too far, and the vocabulary has thousands.
 */
export function editDistance(from: string, to: string, limit = Number.POSITIVE_INFINITY): number {
  const gap = Math.abs(from.length - to.length);
  if (gap > limit) return gap;

  // The distances from the letters of `from` read so far to each start of `to`; first, from nothing.
  let [previous, current] = scratchRows;
  for (let column = 0; column <= to.length; column += 1) previous[column] = column;
  for (let row = 1; row <= from.length; row += 1) {
    const letter = from.charCodeAt(row - 1);
    current[0] = row;
    let smallest = row;
    for (let column = 1; column <= to.length; column += 1) {
      const changed = (previous[column - 1] ?? 0) + (letter === to.charCodeAt(column - 1) ? 0 : 1);
      const distance = Math.min(changed, (previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1);
      current[column] = distance;
      smallest = Math.min(smallest, distance);
    }
    // A row is never better than the smallest of the one before it, so the end of this one is out of reach.
    if (smallest > limit) return smallest;
    [previous, current] = [current, previous];
  }
  return previous[to.length] ?? 0;
}

/** How many letters at the start the two texts share. */
function sharedStart(a: string, b: string): number {
  let length = 0;
  while (length < a.length && a[length] === b[length]) length += 1;
  return length;
}

/**
 * The candidate that a misspelled `input` was most likely meant to be, for a "did you mean" (QUERY_LANGUAGE §5), or
 * `undefined` when none is close enough. Letter case does not count; the candidate is given as it was written.
 *
 * Close enough is at most `max(2, ⌊length of the input / 3⌋)` edits, and fewer edits than the letters of the shorter text:
 * a match keeps a letter of the input, or `x` would be taken for any one-letter field. Of the close ones the nearest wins,
 * then the one that shares the longer start with the input, then the first given.
 */
export function closestMatch(input: string, candidates: readonly string[]): string | undefined {
  const wanted = input.toLowerCase();
  const allowed = Math.max(2, Math.floor(wanted.length / 3));

  let best: { candidate: string; distance: number; start: number } | undefined;
  for (const candidate of candidates) {
    const folded = candidate.toLowerCase();
    const distance = editDistance(wanted, folded, allowed);
    if (distance > allowed || distance >= Math.min(wanted.length, folded.length)) continue;

    const start = sharedStart(wanted, folded);
    if (best === undefined || distance < best.distance || (distance === best.distance && start > best.start)) {
      best = { candidate, distance, start };
    }
  }
  return best?.candidate;
}
