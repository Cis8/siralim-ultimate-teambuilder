/** One tab of a Google Sheet. A new tab (Spells, Relics, …) is a new source, not new fetching code. */
export interface SheetSource {
  /** Names the cached file: `<name>.csv`. */
  readonly name: string;
  readonly spreadsheetId: string;
  readonly gid: string;
}

/** The Siralim Ultimate Compendium, tab Traits (SPEC §2). */
export const TRAITS_SOURCE: SheetSource = {
  name: 'traits',
  spreadsheetId: '1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY',
  gid: '0',
};

export function csvUrl({ spreadsheetId, gid }: SheetSource): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}
