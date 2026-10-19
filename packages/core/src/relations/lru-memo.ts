/**
 * `work` that remembers its last `capacity` answers by `keyOf` of the arguments, and gives the same answer, the very object,
 * to the same question: a call that is repeated is a lookup. The answer least recently asked for is forgotten first. An answer
 * of `undefined` is remembered too; a call that throws is not.
 *
 * @throws RangeError when `capacity` is not a whole number of at least 1.
 */
export function memoiseRecent<Args extends readonly unknown[], Result>(
  capacity: number,
  keyOf: (...args: Args) => string,
  work: (...args: Args) => Result,
): (...args: Args) => Result {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`A memo must hold at least one answer, not ${String(capacity)}.`);
  }
  // A Map iterates in the order its keys were added, so the first key is the one asked for the longest ago. The answer is
  // boxed because `undefined` is an answer too.
  const remembered = new Map<string, { readonly answer: Result }>();

  return (...args) => {
    const key = keyOf(...args);
    const known = remembered.get(key);
    if (known !== undefined) {
      remembered.delete(key);
      remembered.set(key, known);
      return known.answer;
    }
    const answer = work(...args);
    remembered.set(key, { answer });
    for (const oldest of remembered.keys()) {
      if (remembered.size <= capacity) break;
      remembered.delete(oldest);
    }
    return answer;
  };
}
