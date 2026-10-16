/** UTF-16 code unit order, unlike `localeCompare`, which varies with the runtime's locale. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
