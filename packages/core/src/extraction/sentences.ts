/** Where the sentence that contains `position` begins: after the last full stop, "!" or "?" followed by a blank. */
export function sentenceStart(text: string, position: number): number {
  const boundary = /[.!?]\s+/g;
  let start = 0;
  for (const found of text.slice(0, position).matchAll(boundary)) start = found.index + found[0].length;
  return start;
}
