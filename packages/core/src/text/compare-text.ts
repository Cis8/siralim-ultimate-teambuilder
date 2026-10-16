/** UTF-16 code unit order, unlike `localeCompare`, which varies with the runtime's locale. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The order of a list a reader looks through: "of old" before "Of the Beast" before "Offering", whatever the case.
 * Texts that differ only in case are told apart by `compareText`, so the order never depends on the order given.
 */
export function compareTextIgnoringCase(a: string, b: string): number {
  return compareText(a.toLowerCase(), b.toLowerCase()) || compareText(a, b);
}
