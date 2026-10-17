/** Where an address is read from. A browser's `URLSearchParams` is one; `core` knows no URL type of its own. */
export interface ParamReader {
  /** The first value of the parameter, `null` when there is none. */
  get(name: string): string | null;
}

/** Name and value, ready to be written into an address. `URLSearchParams` takes them as they are. */
export type UrlParams = readonly (readonly [name: string, value: string])[];

/**
 * Items are told apart by commas, so a comma inside one is written `%2C`, and a percent sign `%25`. The classes and
 * keywords of the compendium have neither; they are escaped so that a name never splits in two, whatever a dataset holds.
 * An empty item is kept, between its two commas; a list of one empty item is the same text as no list.
 */
export const writeList = (items: readonly string[]): string =>
  items.map((item) => item.replace(/[%,]/gu, (character) => (character === '%' ? '%25' : '%2C'))).join(',');

export const readList = (text: string | null): string[] =>
  text === null || text === ''
    ? []
    : text.split(',').map((item) => item.replace(/%2C|%25/giu, (escape) => (escape === '%25' ? '%' : ',')));
