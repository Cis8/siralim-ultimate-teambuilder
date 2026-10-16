/**
 * Cleans one cell of the sheet so that later stages (ids, keyword spans, search) see a single spelling:
 * every run of blanks (spaces, tabs, line breaks, non-breaking spaces) becomes one space, curly quotes become
 * straight ones, and both ends are trimmed.
 */
export function normaliseText(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
