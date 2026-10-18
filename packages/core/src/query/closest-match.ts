/** How many single-letter edits (a letter added, removed or changed) turn one text into the other. Counts UTF-16 units. */
export function editDistance(from: string, to: string): number {
  const letters = to.split('');
  // The distances from the letters of `from` read so far to each start of `to`; first, from nothing.
  let previous = Array.from({ length: letters.length + 1 }, (_, column) => column);
  let distance = letters.length;
  for (const [row, letter] of from.split('').entries()) {
    const current = [row + 1];
    // `diagonal` is the cell above and to the left of the one being worked out, `left` the one before it in this row.
    let diagonal = row;
    let left = row + 1;
    for (const [column, above] of previous.slice(1).entries()) {
      left = Math.min(diagonal + (letter === letters[column] ? 0 : 1), above + 1, left + 1);
      diagonal = above;
      current.push(left);
    }
    previous = current;
    distance = left;
  }
  return distance;
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
    // The distance is at least the difference in length: most of a vocabulary is out of reach without measuring it.
    if (Math.abs(folded.length - wanted.length) > allowed) continue;
    const distance = editDistance(wanted, folded);
    if (distance > allowed || distance >= Math.min(wanted.length, folded.length)) continue;

    const start = sharedStart(wanted, folded);
    if (best === undefined || distance < best.distance || (distance === best.distance && start > best.start)) {
      best = { candidate, distance, start };
    }
  }
  return best?.candidate;
}
