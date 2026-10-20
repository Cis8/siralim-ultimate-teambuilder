import type { HTMLInputAttributes } from 'svelte/elements';

/**
 * Where a press on the search field opens the search sheet instead of editing in the page (DESIGN § Search sheet): a narrow screen
 * that is touched. The filters turn into a sheet at the same width (`filters-region.svelte`); a mouse or a keyboard has the editor in
 * the field at any width.
 */
export const SEARCH_SHEET_MEDIA = '(max-width: 699px) and (pointer: coarse)';

/**
 * What the editor listens to in a text field, whether it is the one in the page or the one in the sheet: the two are the same editor
 * (they share the issues, the suggestions and the history), told by the same events.
 */
export type FieldEvents = Pick<
  HTMLInputAttributes,
  'oninput' | 'onfocus' | 'onblur' | 'onkeydown' | 'onkeyup' | 'onclick' | 'onselect' | 'onmousedown'
>;

/** What the search finds for the text in the field as it stands: the sheet's button, the line it reads aloud and its "Reads as". */
export interface SheetResults {
  readonly found: number;
  readonly total: number;
  /** The effective query in plain language (`SearchOutcome.effectiveReading`). */
  readonly reading: string;
}

/** Why the star did nothing: the sentence, and whether the way out is the sheet of searches. */
export interface SaveRefusalLine {
  readonly message: string;
  readonly full: boolean;
}
